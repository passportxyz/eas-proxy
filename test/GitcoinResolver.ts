import { expect } from "chai";
import { ethers } from "hardhat";
import { ZERO_BYTES32, NO_EXPIRATION } from "@ethereum-attestation-service/eas-sdk";
import { GitcoinAttester, GitcoinResolver } from "../typechain-types";
import { encodedData, gitcoinVCSchema } from "./GitcoinAttester";
import { SCHEMA_REGISTRY_ABI } from "./abi/SCHEMA_REGISTRY_ABI";

export const schemaRegistryContractAddress =
  process.env.SEPOLIA_SCHEMA_REGISTRY_ADDRESS ||
  "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";

describe.only("GitcoinResolver", function () {
  let owner: any,
    iamAccount: any,
    recipient: any,
    nonOwnerOrVerifier: any,
    mockEas: any,
    gitcoinResolver: GitcoinResolver,
    gitcoinAttester: GitcoinAttester;

  before(async function () {
    const [
      ownerAccount,
      otherAccount,
      recipientAccount,
      mockEasContractAccount,
      nonOwnerOrVerifierAccount,
    ] = await ethers.getSigners();

    owner = ownerAccount;
    iamAccount = otherAccount;
    recipient = recipientAccount;
    mockEas = mockEasContractAccount;
    nonOwnerOrVerifier = nonOwnerOrVerifierAccount;

    const GitcoinAttester = await ethers.getContractFactory(
      "GitcoinAttester",
      owner
    );
    gitcoinAttester = await GitcoinAttester.deploy();
    await gitcoinAttester.connect(owner).initialize();
    const gitcoinAttesterAddress = await gitcoinAttester.getAddress();

    // Initialize the sdk with the address of the EAS Schema contract address
    await gitcoinAttester.setEASAddress(mockEas);

    const GitcoinResolver = await ethers.getContractFactory(
      "GitcoinResolver",
      owner
    );
    gitcoinResolver = await GitcoinResolver.deploy();
    await gitcoinResolver
      .connect(owner)
      .initialize(mockEas.address, gitcoinAttesterAddress);
    const gitcoinResolverAddress = await gitcoinResolver.getAddress();

    this.uid = ethers.keccak256(ethers.toUtf8Bytes("test"));

    this.validAttestation = {
      uid: this.uid,
      schema: gitcoinVCSchema,
      time: NO_EXPIRATION,
      expirationTime: NO_EXPIRATION,
      revocationTime: NO_EXPIRATION,
      refUID: ZERO_BYTES32,
      recipient: recipient.address,
      attester: gitcoinAttesterAddress,
      revocable: true,
      data: encodedData,
    };

    const schemaRegistry = new ethers.Contract(
      schemaRegistryContractAddress,
      SCHEMA_REGISTRY_ABI,
      owner
    );

    const schema = "uint256 eventId, uint8 voteIndex";
    const resolverAddress = gitcoinResolverAddress;
    const revocable = true;

    const transaction = await schemaRegistry.register(
      schema,
      resolverAddress,
      revocable
    );

    await transaction.wait();
  });

  describe("Attestations", function () {
    it("should make 1 attestation", async function () {
      await expect(
        gitcoinResolver.connect(mockEas).attest(this.validAttestation)
      )
        .to.emit(gitcoinResolver, "PassportAdded")
        .withArgs(this.validAttestation.recipient, this.uid);

      const attestationUID = await gitcoinResolver.passports(recipient.address);

      expect(attestationUID).to.equal(this.uid);
    });

    it("should make multiple attestations", async function () {
      await expect(gitcoinResolver
        .connect(mockEas)
        .multiAttest(
          [this.validAttestation, this.validAttestation, this.validAttestation],
          []
        ))
          .to.emit(gitcoinResolver, "PassportAdded");

      const attestationUID = await gitcoinResolver.passports(recipient.address);

      expect(attestationUID).to.equal(this.uid);
    });

    it("should revert when a non-allowed address attempts to make any attestation", async function () {
      await expect(
        gitcoinResolver.connect(iamAccount).attest(this.validAttestation)
      ).to.be.revertedWith("Only EAS contract can call this function");
    });

    it("should revert if an address other than the Gitcoin attester attempts to make an attestation", async function () {
      const uid = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const attestation = {
        uid,
        schema: gitcoinVCSchema,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester: nonOwnerOrVerifier.address,
        revocable: true,
        data: encodedData,
      };

      await expect(
        gitcoinResolver.connect(mockEas).attest(attestation)
      ).to.be.revertedWith("Only the Gitcoin Attester can make attestations");
    });
  });

  describe("Revocations", function () {
    it("should make 1 revocation", async function () {
      // Make an attestation
      await gitcoinResolver.connect(mockEas).attest(this.validAttestation);
      await expect(gitcoinResolver
        .connect(mockEas)
        .revoke(this.validAttestation))
        .to.emit(gitcoinResolver, "PassportRemoved")
        .withArgs(this.validAttestation.recipient, this.uid);
    });

    it("Should make multiple revocations", async function () {
      await gitcoinResolver
        .connect(mockEas)
        .multiAttest(
          [this.validAttestation, this.validAttestation, this.validAttestation], []
        );
      await expect(gitcoinResolver
        .connect(mockEas)
        .multiRevoke(
          [this.validAttestation, this.validAttestation, this.validAttestation],
          []
        )).to.emit(gitcoinResolver, "PassportRemoved");

      let attestationUID = await gitcoinResolver.passports(recipient.address);
      expect(attestationUID).to.equal(ethers.ZeroHash);
    });

    it("should allow a user to revoke their own attestation", async function () {
      const validAttestation = {
        uid: this.uid,
        schema: gitcoinVCSchema,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester: recipient,
        revocable: true,
        data: encodedData,
      };
      // Make an attestations
      await gitcoinResolver.connect(mockEas).attest(this.validAttestation);
      // Get the result of the revocation made by the user
      await expect(gitcoinResolver
        .connect(recipient)
        .revoke(validAttestation))
        .to.emit(gitcoinResolver, "PassportRemoved")
        .withArgs(validAttestation.recipient, this.uid);

        let attestationUID = await gitcoinResolver.passports(recipient.address);
        expect(attestationUID).to.equal(ethers.ZeroHash);
    });

    it("should allow a user to revoke their own attestations", async function () {
      const validAttestation = {
        uid: this.uid,
        schema: gitcoinVCSchema,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester: recipient,
        revocable: true,
        data: encodedData,
      };
      // Make an attestations
      await gitcoinResolver
        .connect(mockEas)
        .multiAttest(
          [this.validAttestation, this.validAttestation, this.validAttestation], []
        );
      // Get the result of the revocation made by the user
      await expect(gitcoinResolver
        .connect(recipient)
        .multiRevoke([validAttestation, validAttestation, validAttestation], []))
        .to.emit(gitcoinResolver, "PassportRemoved");

        let attestationUID = await gitcoinResolver.passports(recipient.address);
        expect(attestationUID).to.equal(ethers.ZeroHash);
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
