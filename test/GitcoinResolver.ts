import { expect } from "chai";
import { ethers } from "hardhat";
import {
  ZERO_BYTES32,
  NO_EXPIRATION
} from "@ethereum-attestation-service/eas-sdk";
import { GitcoinAttester, GitcoinResolver } from "../typechain-types";
import { encodedData, getScoreAttestation } from "./helpers/mockAttestations";
import { SCHEMA_REGISTRY_ABI } from "./abi/SCHEMA_REGISTRY_ABI";
import { AttestationStruct } from "../typechain-types/contracts/GitcoinResolver";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export const schemaRegistryContractAddress =
  process.env.SEPOLIA_SCHEMA_REGISTRY_ADDRESS ||
  "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";

async function registerSchema(
  owner: any,
  gitcoinResolverAddress: string,
  schema: string
): Promise<string> {
  const schemaRegistry = new ethers.Contract(
    schemaRegistryContractAddress,
    SCHEMA_REGISTRY_ABI,
    owner
  );

  const revocable = true;

  const transaction = await schemaRegistry.register(
    schema,
    gitcoinResolverAddress,
    revocable
  );

  const registerTransactionReceipt = await transaction.wait();

  const registerEvent = registerTransactionReceipt.logs.filter((log: any) => {
    return log.fragment.name == "Registered";
  });

  return registerEvent[0].args[0];
}

describe("GitcoinResolver", function () {
  let owner: any,
    iamAccount: any,
    recipient: any,
    nonOwnerOrVerifier: any,
    mockEas: any,
    gitcoinResolver: GitcoinResolver,
    gitcoinAttester: GitcoinAttester,
    recipients: HardhatEthersSigner[],
    nextRecipientIndex: number = 0;

  this.beforeEach(async function () {
    // Make sure to use a different recipient for each test
    recipient = recipients[nextRecipientIndex++];
  });

  before(async function () {
    const [
      _ownerAccount,
      _iamAccount,
      _recipientAccount,
      _mockEasContractAccount,
      _nonOwnerOrVerifierAccount,
      ...moreSigners
    ] = await ethers.getSigners();

    owner = _ownerAccount;
    iamAccount = _iamAccount;
    mockEas = _mockEasContractAccount;
    nonOwnerOrVerifier = _nonOwnerOrVerifierAccount;
    recipients = moreSigners;

    const GitcoinAttester = await ethers.getContractFactory(
      "GitcoinAttester",
      owner
    );
    gitcoinAttester = await GitcoinAttester.deploy();
    await gitcoinAttester.connect(owner).initialize();
    this.gitcoinAttesterAddress = await gitcoinAttester.getAddress();

    // Initialize the sdk with the address of the EAS Schema contract address
    await gitcoinAttester.setEASAddress(mockEas);

    const GitcoinResolver = await ethers.getContractFactory(
      "GitcoinResolver",
      owner
    );
    gitcoinResolver = await GitcoinResolver.deploy();
    await gitcoinResolver
      .connect(owner)
      .initialize(mockEas.address, this.gitcoinAttesterAddress);

    const gitcoinResolverAddress = await gitcoinResolver.getAddress();

    this.uid = ethers.keccak256(ethers.toUtf8Bytes("test"));

    this.testSchemaUID = await registerSchema(
      owner,
      gitcoinResolverAddress,
      "uint256 eventId, uint8 voteIndex"
    );
    this.scoreSchemaId = await registerSchema(
      owner,
      gitcoinResolverAddress,
      "uint256 score, uint8 scorer_id, uint8 score_decimals"
    );

    await gitcoinResolver.connect(owner).setScoreSchema(this.scoreSchemaId);

    this.validAttestation = {
      uid: this.uid,
      schema: this.testSchemaUID,
      time: NO_EXPIRATION,
      expirationTime: NO_EXPIRATION,
      revocationTime: NO_EXPIRATION,
      refUID: ZERO_BYTES32,
      recipient: _recipientAccount.address,
      attester: this.gitcoinAttesterAddress,
      revocable: true,
      data: encodedData
    };
  });

  describe("Attestations", function () {
    it("should make 1 attestation", async function () {
      await gitcoinResolver.connect(mockEas).attest(this.validAttestation);

      const attestationUID = await gitcoinResolver.userAttestations(
        this.validAttestation.recipient,
        this.testSchemaUID
      );

      expect(attestationUID).to.equal(this.uid);
    });

    it("should make multiple attestations", async function () {
      await gitcoinResolver
        .connect(mockEas)
        .multiAttest(
          [this.validAttestation, this.validAttestation, this.validAttestation],
          []
        );

      const attestationUID = await gitcoinResolver.userAttestations(
        this.validAttestation.recipient,
        this.testSchemaUID
      );

      expect(attestationUID).to.equal(this.uid);
    });

    it("should revert when a non-allowed address attempts to make any attestation", async function () {
      await expect(
        gitcoinResolver.connect(iamAccount).attest(this.validAttestation)
      ).to.be.revertedWithCustomError(gitcoinResolver, "NotAllowlisted");
    });

    it("should revert if an address other than the Gitcoin attester attempts to make an attestation", async function () {
      const uid = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const attestation = {
        uid,
        schema: this.testSchemaUID,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester: nonOwnerOrVerifier.address,
        revocable: true,
        data: encodedData
      };

      await expect(
        gitcoinResolver.connect(mockEas).attest(attestation)
      ).to.be.revertedWithCustomError(gitcoinResolver, "InvalidAttester");
    });
  });

  describe("Caching Scores", function () {
    it("should cache a score and properly reduce the number of decimals when there are more than 4", async function () {
      const attestation = getScoreAttestation(
        {
          schema: this.scoreSchemaId,
          recipient: recipient.address,
          attester: this.gitcoinAttesterAddress
        },
        {
          score: "12345678000000000000", // That is 12.345678000000000000 (18 decimals)
          scorer_id: 1,
          score_decimals: 18
        }
      ) as AttestationStruct;

      attestation.time = 200500;
      attestation.expirationTime = 700500;
      const attestRequest = await gitcoinResolver
        .connect(mockEas)
        .attest(attestation);
      const attestReceipt = attestRequest.wait();

      const score = await gitcoinResolver.getCachedScore(recipient.address);

      // Score should have been casted to a 4 digit value
      expect(score[0]).to.equal("123456");
      expect(score[1]).to.equal("200500");
      expect(score[2]).to.equal("700500");
    });

    it("should cache a score and properly increase the number of decimals when there are less than 4", async function () {
      const attestation = getScoreAttestation(
        {
          schema: this.scoreSchemaId,
          recipient: recipient.address,
          attester: this.gitcoinAttesterAddress
        },
        {
          score: "1234", // That is 12.34 (2 decimals)
          scorer_id: 2,
          score_decimals: 2
        }
      ) as AttestationStruct;

      attestation.time = 200500;
      attestation.expirationTime = 700500;
      const attestRequest = await gitcoinResolver
        .connect(mockEas)
        .attest(attestation);
      const attestReceipt = attestRequest.wait();

      const score = await gitcoinResolver.getCachedScore(recipient.address);

      // Score should have been casted to a 4 digit value
      expect(score[0]).to.equal("123400");
      expect(score[1]).to.equal("200500");
      expect(score[2]).to.equal("700500");
    });

    it("should cache a score and keep the score unchanged when there are 4 decimals", async function () {
      const attestation = getScoreAttestation(
        {
          schema: this.scoreSchemaId,
          recipient: recipient.address,
          attester: this.gitcoinAttesterAddress
        },
        {
          score: "123456", // That is 12.34 (2 decimals)
          scorer_id: 3,
          score_decimals: 4
        }
      ) as AttestationStruct;

      attestation.time = 200500;
      attestation.expirationTime = 700500;
      const attestRequest = await gitcoinResolver
        .connect(mockEas)
        .attest(attestation);
      const attestReceipt = attestRequest.wait();

      const score = await gitcoinResolver.getCachedScore(recipient.address);

      // Score should have been casted to a 4 digit value
      expect(score[0]).to.equal("123456");
      expect(score[1]).to.equal("200500");
      expect(score[2]).to.equal("700500");
    });

    it("should cache a score from an attestation that is part of a multiAttest call", async function () {
      const attestation = getScoreAttestation(
        {
          schema: this.scoreSchemaId,
          recipient: recipient.address,
          attester: this.gitcoinAttesterAddress
        },
        {
          score: "98765", // That is 12.34 (2 decimals)
          scorer_id: 3,
          score_decimals: 4
        }
      ) as AttestationStruct;

      await gitcoinResolver
        .connect(mockEas)
        .multiAttest([this.validAttestation, attestation], []);

      const score = await gitcoinResolver.getCachedScore(recipient.address);

      // Score should have been casted to a 4 digit value
      expect(score[0]).to.equal("98765");
    });

    it("should remove a cached score if the attestation is revoked (attest and revoke calls)", async function () {
      const attestation = getScoreAttestation(
        {
          schema: this.scoreSchemaId,
          recipient: recipient.address,
          attester: this.gitcoinAttesterAddress,
          time: 1234,
          expirationTime: 5678
        },
        {
          score: "98765", // That is 98.7650
          scorer_id: 3,
          score_decimals: 4
        }
      ) as AttestationStruct;

      await gitcoinResolver.connect(mockEas).attest(attestation);

      const scoreBeforeRevocation = await gitcoinResolver.getCachedScore(
        recipient.address
      );

      // Score should have been casted to a 4 digit value
      expect(scoreBeforeRevocation[0]).to.equal("98765");
      expect(scoreBeforeRevocation[1]).to.equal("1234");
      expect(scoreBeforeRevocation[2]).to.equal("5678");

      await gitcoinResolver.connect(mockEas).revoke(attestation);

      const scoreAfterRevocation = await gitcoinResolver.getCachedScore(
        recipient.address
      );

      // Score should have been casted to a 4 digit value
      expect(scoreAfterRevocation[0]).to.equal("0");
      expect(scoreAfterRevocation[1]).to.equal("0");
      expect(scoreAfterRevocation[2]).to.equal("0");
    });

    it("should remove a cached score if the attestation is revoked (multiAttest and multiRevoke calls)", async function () {
      const attestation = getScoreAttestation(
        {
          schema: this.scoreSchemaId,
          recipient: recipient.address,
          attester: this.gitcoinAttesterAddress,
          time: 1234,
          expirationTime: 5678
        },
        {
          score: "983855", // That is 98.3855
          scorer_id: 3,
          score_decimals: 4
        }
      ) as AttestationStruct;

      await gitcoinResolver
        .connect(mockEas)
        .multiAttest([attestation, this.validAttestation], []);

      const scoreBeforeRevocation = await gitcoinResolver.getCachedScore(
        recipient.address
      );

      // Score should have been casted to a 4 digit value
      expect(scoreBeforeRevocation[0]).to.equal("983855");
      expect(scoreBeforeRevocation[1]).to.equal("1234");
      expect(scoreBeforeRevocation[2]).to.equal("5678");

      await gitcoinResolver
        .connect(mockEas)
        .multiRevoke([attestation, this.validAttestation], []);

      const scoreAfterRevocation = await gitcoinResolver.getCachedScore(
        recipient.address
      );

      // Score should have been casted to a 4 digit value
      expect(scoreAfterRevocation[0]).to.equal("0");
      expect(scoreAfterRevocation[1]).to.equal("0");
      expect(scoreAfterRevocation[2]).to.equal("0");
    });
  });

  describe("Revocations", function () {
    it("should make 1 revocation", async function () {
      // Make an attestation
      await gitcoinResolver.connect(mockEas).attest(this.validAttestation);
      await gitcoinResolver.connect(mockEas).revoke(this.validAttestation);
    });

    it("Should make multiple revocations", async function () {
      await gitcoinResolver
        .connect(mockEas)
        .multiAttest(
          [this.validAttestation, this.validAttestation, this.validAttestation],
          []
        );
      await gitcoinResolver
        .connect(mockEas)
        .multiRevoke(
          [this.validAttestation, this.validAttestation, this.validAttestation],
          []
        );

      let attestationUID = await gitcoinResolver.userAttestations(
        recipient.address,
        this.testSchemaUID
      );

      expect(attestationUID).to.equal(ethers.ZeroHash);
    });

    it("should allow a eas to revoke a user's attestation", async function () {
      const validAttestation = {
        uid: this.uid,
        schema: this.testSchemaUID,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester: recipient,
        revocable: true,
        data: encodedData
      };
      // Make an attestations
      await gitcoinResolver.connect(mockEas).attest(this.validAttestation);
      // Get the result of the revocation made by the user
      await gitcoinResolver.connect(mockEas).revoke(validAttestation);

      let attestationUID = await gitcoinResolver.userAttestations(
        recipient.address,
        this.testSchemaUID
      );
      expect(attestationUID).to.equal(ethers.ZeroHash);
    });

    it("should not allow non-EAS to revoke a user's attestations", async function () {
      const validAttestation = {
        uid: this.uid,
        schema: this.testSchemaUID,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester: recipient,
        revocable: true,
        data: encodedData
      };
      // Make an attestations
      await gitcoinResolver
        .connect(mockEas)
        .multiAttest(
          [this.validAttestation, this.validAttestation, this.validAttestation],
          []
        );
      // Get the result of the revocation made by the user
      await expect(
        gitcoinResolver
          .connect(recipient)
          .multiRevoke(
            [validAttestation, validAttestation, validAttestation],
            []
          )
      ).to.be.revertedWithCustomError(gitcoinResolver, "NotAllowlisted");
    });
  });

  describe("Pausability", function () {
    it("should pause and unpause", async function () {
      await gitcoinResolver.pause();
      expect(await gitcoinResolver.paused()).to.equal(true);
      await gitcoinResolver.unpause();
      expect(await gitcoinResolver.paused()).to.equal(false);
    });

    it("should revert when paused", async function () {
      await gitcoinResolver.pause();
      await expect(
        gitcoinResolver.attest(this.validAttestation)
      ).to.be.revertedWith("Pausable: paused");
      await gitcoinResolver.unpause();
    });

    it("should not allow non owner to pause", async function () {
      await expect(
        gitcoinResolver.connect(nonOwnerOrVerifier).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
