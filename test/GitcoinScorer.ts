import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EAS,
  Offchain,
  SchemaEncoder,
  SchemaRegistry,
  Delegated,
  ZERO_BYTES32,
  NO_EXPIRATION,
  ATTEST_TYPE,
  ATTEST_PRIMARY_TYPE,
} from "@ethereum-attestation-service/eas-sdk";
import { GitcoinScorer } from "../typechain-types";

const utils = ethers.utils;

describe("GitcoinScorer", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.

  describe("Deployment", function () {
    let gitcoinScorer: GitcoinScorer,
      eas,
      EASContractAddress: string,
      owner: any,
      iamAccount: any,
      gitcoinVerifier: any,
      recipient: any;

    this.beforeAll(async function () {
      async function deployGitcoinScorer() {
        // Deployment and ABI: SchemaRegistry.json
        // Sepolia

        // v0.26

        // EAS:
        // Contract: 0xC2679fBD37d54388Ce493F1DB75320D236e1815e
        // Deployment and ABI: EAS.json
        // SchemaRegistry:
        // Contract: 0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0
        // Deployment and ABI: SchemaRegistry.json
        EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26

        // Contracts are deployed using the first signer/account by default
        const [ownerAccount, otherAccount, recipientAccount] =
          await ethers.getSigners();

        owner = ownerAccount;
        iamAccount = otherAccount;
        recipient = recipientAccount;

        const GitcoinScorer = await ethers.getContractFactory("GitcoinScorer");
        gitcoinScorer = await GitcoinScorer.connect(owner).deploy();

        const provider = ethers.getDefaultProvider(1);

        // Initialize the sdk with the address of the EAS Schema contract address
        eas = new EAS(EASContractAddress);

        // Connects an ethers style provider/signingProvider to perform read/write functions.
        // MUST be a signer to do write operations!
        eas.connect(provider);
      }

      await loadFixture(deployGitcoinScorer);
    });

    it("Should store the weights", async function () {
      await gitcoinScorer.setEASAddress(EASContractAddress);

      const weights: string[][] = [];

      weights.push([]);

      for (let i = 0; i < 256; i++) {
        weights[0].push("1");
      }

      await gitcoinScorer.setWeights(weights);

      let weight = await gitcoinScorer.weights(0, 1);
      expect(weight).to.equal("1");

      weight = await gitcoinScorer.weights(0, 255);
      expect(weight).to.equal("1");

      await expect(gitcoinScorer.weights(0, 256)).to.be.revertedWithoutReason();
      await expect(gitcoinScorer.weights(1, 0)).to.be.revertedWithoutReason();
    });
  });
});
