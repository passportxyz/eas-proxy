import { expect } from "chai";
import { ethers, network } from "hardhat";
import { reset } from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { multiAttestationRequest } from "./helpers/mockAttestations";

// This is partially complete, but we don't currently have the EASWrappedVeraxPortal contract
// defined in this repo. So for now, let's just skip this
describe.skip("EASWrappedVeraxPortal", function () {
  let EASPortal;
  let easPortal: any;
  let owner: any;
  let addr1: any;
  let originalForkingUrl: string;

  this.beforeAll(async () => {
    originalForkingUrl = network.config.forking.url;

    // Change forking provider to Linea
    await reset(process.env.LINEA_TESTNET_PROVIDER);

    [owner, addr1] = await ethers.getSigners();
    EASPortal = await ethers.getContractFactory("EASWrappedVeraxPortal", owner);
    easPortal = await EASPortal.deploy();
    await easPortal
      .connect(owner)
      .initialize(
        [],
        "0x1a20b2CFA134686306436D2c9f778D7eC6c43A43",
        "0xC765F28096F6121C2F2b82D35A4346280164428b"
      );
  });

  this.afterAll(async () => {
    await reset(originalForkingUrl);
  });

  describe("Initialization", () => {
    it("Should set the correct owner", async () => {
      expect(await easPortal.owner()).to.equal(owner.address);
    });
  });

  describe("setResolverAddress", () => {
    it("Should set resolver address correctly", async () => {
      await easPortal.connect(owner).setResolverAddress(addr1.address);
      expect(await easPortal.resolverAddress()).to.equal(addr1.address);
    });

    it("Should revert if non-owner tries to set", async () => {
      await expect(
        easPortal.connect(addr1).setResolverAddress(addr1.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("pause and unpause", () => {
    it("Should pause and unpause contract", async () => {
      await easPortal.connect(owner).pause();
      expect(await easPortal.paused()).to.equal(true);

      await easPortal.connect(owner).unpause();
      expect(await easPortal.paused()).to.equal(false);
    });

    it("Should revert if non-owner tries to pause or unpause", async () => {
      await expect(easPortal.connect(addr1).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      await expect(easPortal.connect(addr1).unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("multiAttest", () => {
    it("Should call multiAttest successfully", async () => {
      // Assuming multiAttest is a non-void function and returns something.
      const result = await easPortal.multiAttest([multiAttestationRequest]);
      expect(result).to.not.be.null;
    });
  });

  describe("multiRevoke", () => {
    it("Should call multiRevoke successfully", async () => {
      const multiRevocationRequests = [
        {
          data: [
            {
              uid: "0xuid1",
            },
          ],
        },
        {
          data: [
            {
              uid: "0xuid2",
            },
          ],
        },
      ];

      // For simplicity, just checking if the transaction is successful.
      await expect(easPortal.multiRevoke(multiRevocationRequests)).to.emit(
        easPortal,
        "Revoked"
      ); // Replace with the actual event that should be emitted
    });
  });

  describe("getAttestation", () => {
    it("Should return attestation details", async () => {
      const uid = "0xuid1";

      // Presumably, you've called multiAttest or another method to populate data.
      // For now, we'll assume that the uid "0xuid1" is present in the contract's data.

      const attestation = await easPortal.getAttestation(uid);
      expect(attestation).to.not.be.null;
      expect(attestation.attestationId).to.equal(uid);
    });
  });
});
