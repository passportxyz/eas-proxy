import { expect } from "chai";
import { ethers } from "hardhat";
import {
  ZERO_BYTES32,
  NO_EXPIRATION,
} from "@ethereum-attestation-service/eas-sdk";
import { GitcoinAttester, GitcoinResolver } from "../typechain-types";
import { encodedData } from "./GitcoinAttester";
import { SCHEMA_REGISTRY_ABI } from "./abi/SCHEMA_REGISTRY_ABI";

export const schemaRegistryContractAddress =
  process.env.SEPOLIA_SCHEMA_REGISTRY_ADDRESS ||
  "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";

describe("GitcoinResolver", function () {
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

    const registerTransactionReceipt = await transaction.wait();

    const registerEvent = registerTransactionReceipt.logs.filter((log: any) => {
      return log.fragment.name == "Registered";
    });

    this.schemaUID = registerEvent[0].args[0];

    this.validAttestation = {
      uid: this.uid,
      schema: this.schemaUID,
      time: NO_EXPIRATION,
      expirationTime: NO_EXPIRATION,
      revocationTime: NO_EXPIRATION,
      refUID: ZERO_BYTES32,
      recipient: recipient.address,
      attester: gitcoinAttesterAddress,
      revocable: true,
      data: encodedData,
    };
  });

  describe("Attestations", function () {
    it("should make 1 attestation", async function () {
      await gitcoinResolver.connect(mockEas).attest(this.validAttestation);

      const attestationUID = await gitcoinResolver.userAttestations(
        recipient.address,
        this.schemaUID
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
        recipient.address,
        this.schemaUID
      );

      expect(attestationUID).to.equal(this.uid);
    });

    it("should revert when a non-allowed address attempts to make any attestation", async function () {
      await expect(
        gitcoinResolver.connect(iamAccount).attest(this.validAttestation)
      ).to.be.revertedWith("Only EAS can call this function");
    });

    it("should revert if an address other than the Gitcoin attester attempts to make an attestation", async function () {
      const uid = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const attestation = {
        uid,
        schema: this.schemaUID,
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
      ).to.be.revertedWith("Invalid attester");
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
        this.schemaUID
      );

      expect(attestationUID).to.equal(ethers.ZeroHash);
    });

    it("should allow a eas to revoke a user's attestation", async function () {
      const validAttestation = {
        uid: this.uid,
        schema: this.schemaUID,
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
      await gitcoinResolver.connect(mockEas).revoke(validAttestation);

      let attestationUID = await gitcoinResolver.userAttestations(
        recipient.address,
        this.schemaUID
      );
      expect(attestationUID).to.equal(ethers.ZeroHash);
    });

    it("should not allow non-EAS to revoke a user's attestations", async function () {
      const validAttestation = {
        uid: this.uid,
        schema: this.schemaUID,
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
      ).to.be.revertedWith("Only EAS can call this function");
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
