import { ZERO_BYTES } from "@ethereum-attestation-service/eas-sdk";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  multiAttestationRequest,
  gitcoinVCSchema,
} from "./helpers/mockAttestations";
import { GITCOIN_SCORE_SCHEMA } from "./helpers/verifierTests";

describe("GitcoinVeraxPortal", function () {
  let GitcoinVeraxPortal: any;
  let gitcoinVeraxPortal: any;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let attester: any;
  let registry: any;

  // Mock data for attestation
  const mockVeraxSchemaId = ethers.keccak256(
    ethers.toUtf8Bytes("mockVeraxSchemaId")
  );

  beforeEach(async () => {
    GitcoinVeraxPortal = await ethers.getContractFactory("GitcoinVeraxPortal");
    [owner, addr1, addr2] = await ethers.getSigners();

    // You'd need to deploy or mock other contracts (IAttestationRegistry, ISchemaResolver) to initialize the portal
    const MockResolver = await ethers.getContractFactory("MockResolver"); // Assume you have mock contracts
    const MockRegistry = await ethers.getContractFactory(
      "VeraxAttestationRegistry"
    );
    const resolver = await MockResolver.deploy();
    registry = await MockRegistry.deploy();

    attester = addr2.address;

    gitcoinVeraxPortal = await GitcoinVeraxPortal.deploy();
    await gitcoinVeraxPortal["initialize(address,address,address)"](
      attester,
      await resolver.getAddress(),
      await registry.getAddress()
    );
  });

  describe("Initialization", function () {
    it("Should set the correct attester", async function () {
      expect(await gitcoinVeraxPortal.attester()).to.equal(attester);
    });
  });

  describe("Schema Mapping", function () {
    it("Should allow owner to add schema mapping", async function () {
      await gitcoinVeraxPortal.addSchemaMapping(
        gitcoinVCSchema,
        mockVeraxSchemaId
      );
      expect(await gitcoinVeraxPortal.schemaMapping(gitcoinVCSchema)).to.equal(
        mockVeraxSchemaId
      );
    });

    it("Should not allow non-owners to add schema mapping", async function () {
      await expect(
        gitcoinVeraxPortal
          .connect(addr1)
          .addSchemaMapping(gitcoinVCSchema, mockVeraxSchemaId)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Allowlist", function () {
    it("Should allow owner to add to the allowlist", async function () {
      await gitcoinVeraxPortal.addToAllowlist(addr1.address);
      expect(await gitcoinVeraxPortal.allowlist(addr1.address)).to.equal(true);
    });

    it("Should allow owner to remove from the allowlist", async function () {
      await gitcoinVeraxPortal.addToAllowlist(addr1.address);
      await gitcoinVeraxPortal.removeFromAllowlist(addr1.address);
      expect(await gitcoinVeraxPortal.allowlist(addr1.address)).to.equal(false);
    });

    it("Should not allow non-owners to modify the allowlist", async function () {
      await expect(
        gitcoinVeraxPortal.connect(addr1).addToAllowlist(addr2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await gitcoinVeraxPortal.addToAllowlist(addr2.address);
      await expect(
        gitcoinVeraxPortal.connect(addr1).removeFromAllowlist(addr2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow non-allowlisted to submitAttestations", async function () {
      await expect(
        gitcoinVeraxPortal
          .connect(addr1)
          .submitAttestations([multiAttestationRequest])
      ).to.be.revertedWithCustomError(gitcoinVeraxPortal, "NotAllowlisted");
    });

    it("Should not allow non-allowlisted to modify submitAttestations", async function () {
      await expect(
        gitcoinVeraxPortal
          .connect(addr1)
          .submitAttestations([multiAttestationRequest])
      ).to.be.revertedWithCustomError(gitcoinVeraxPortal, "NotAllowlisted");
    });
  });

  describe("Pausing", function () {
    it("Should allow owner to pause the contract", async function () {
      await gitcoinVeraxPortal.pause();
      expect(await gitcoinVeraxPortal.paused()).to.equal(true);
    });

    it("Should not allow non-owners to pause the contract", async function () {
      await expect(
        gitcoinVeraxPortal.connect(addr1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should allow owner to unpause the contract", async function () {
      await gitcoinVeraxPortal.pause();
      await gitcoinVeraxPortal.unpause();
      expect(await gitcoinVeraxPortal.paused()).to.equal(false);
    });

    it("Should not allow non-owners to unpause the contract", async function () {
      await gitcoinVeraxPortal.pause();
      await expect(
        gitcoinVeraxPortal.connect(addr1).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Attestation Submission", function () {
    it("Should not allow non-allowlisted to submitAttestations", async function () {
      await expect(
        gitcoinVeraxPortal
          .connect(addr1)
          .submitAttestations([multiAttestationRequest])
      ).to.be.revertedWithCustomError(gitcoinVeraxPortal, "NotAllowlisted");
    });

    it("Should not allow submitAttestations when paused", async function () {
      await gitcoinVeraxPortal.addToAllowlist(addr1.address);

      await gitcoinVeraxPortal.pause();

      await expect(
        gitcoinVeraxPortal
          .connect(addr1)
          .submitAttestations([multiAttestationRequest])
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow valid submitAttestations", async function () {
      await gitcoinVeraxPortal.addToAllowlist(addr1.address);

      await gitcoinVeraxPortal.addSchemaMapping(
        gitcoinVCSchema,
        mockVeraxSchemaId
      );

      await expect(
        gitcoinVeraxPortal
          .connect(addr1)
          .submitAttestations([
            multiAttestationRequest,
            multiAttestationRequest,
          ])
      ).to.not.be.reverted;

      expect(await registry.attesterLog(0)).to.equal(attester);
      expect(await registry.schemaLog(0)).to.equal(mockVeraxSchemaId);
      expect(await registry.schemaLog(5)).to.equal(mockVeraxSchemaId);
    });
  });
});
