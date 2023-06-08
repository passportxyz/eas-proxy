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
import { GitcoinAttester } from "../typechain-types";

const utils = ethers.utils;

const googleStamp = {
  provider: "Google",
  stampHash: "234567890",
};

const facebookStamp = {
  provider: "Facebook",
  stampHash: "234567891",
};

type Stamp = {
  provider: string;
  stampHash: string;
};

type Score = {
  score: number;
  scorer_id: number;
};

export const easEncodeScore = (score: Score) => {
  const schemaEncoder = new SchemaEncoder("uint32 score,uint32 scorer_id");
  const encodedData = schemaEncoder.encodeData([
    { name: "score", value: score.score, type: "uint32" },
    { name: "scorer_id", value: score.scorer_id, type: "uint32" },
  ]);
  return encodedData;
};

export const easEncodeStamp = (stamp: Stamp) => {
  const schemaEncoder = new SchemaEncoder("bytes32 provider, bytes32 hash");
  let providerValue = utils.keccak256(utils.toUtf8Bytes(stamp.provider));

  const encodedData = schemaEncoder.encodeData([
    { name: "provider", value: providerValue, type: "bytes32" },
    { name: "hash", value: providerValue, type: "bytes32" }, // TODO decode hash here
  ]);
  return encodedData;
};

const encodedData = easEncodeStamp({
  provider: "TestProvider",
  stampHash: "234567890",
});

const attestationRequest = {
  recipient: "0x4A13F4394cF05a52128BdA527664429D5376C67f",
  // Unix timestamp of when attestation expires. (0 for no expiration)
  expirationTime: NO_EXPIRATION,
  revocable: true,
  data: encodedData,
  refUID: ZERO_BYTES32,
  value: 0,
};

const gitcoinVCSchema =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";

const multiAttestationRequests = {
  schema: gitcoinVCSchema,
  data: [attestationRequest, attestationRequest, attestationRequest],
};

describe("GitcoinAttester", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.

  describe("Deployment", function () {
    let gitcoinAttester: GitcoinAttester,
      eas,
      EASContractAddress: string,
      owner: any,
      iamAccount: any,
      gitcoinVerifier: any,
      recipient: any;

    this.beforeAll(async function () {
      async function deployGitcoinAttester() {
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

        const GitcoinAttester = await ethers.getContractFactory(
          "GitcoinAttester"
        );
        gitcoinAttester = await GitcoinAttester.connect(owner).deploy();

        const provider = ethers.getDefaultProvider();

        // Initialize the sdk with the address of the EAS Schema contract address
        eas = new EAS(EASContractAddress);

        // Connects an ethers style provider/signingProvider to perform read/write functions.
        // MUST be a signer to do write operations!
        eas.connect(provider);

        const GitcoinVerifier = await ethers.getContractFactory(
          "GitcoinVerifier"
        );
        gitcoinVerifier = await GitcoinVerifier.deploy(
          iamAccount.address,
          gitcoinAttester.address
        );
      }

      await loadFixture(deployGitcoinAttester);
    });

    it("Should write multiple attestations", async function () {
      await gitcoinAttester.setEASAddress(EASContractAddress);

      const tx = await gitcoinAttester.addVerifier(owner.address);
      await tx.wait();

      const resultTx = await gitcoinAttester.submitAttestations([
        multiAttestationRequests,
      ]);

      const result = await resultTx.wait();

      expect(result.events?.length).to.equal(
        multiAttestationRequests.data.length
      );
    });

    it("Should not allow non-whitelisted verifier to write attestations", async function () {
      await gitcoinAttester.setEASAddress(EASContractAddress);
      try {
        await gitcoinAttester
          .connect(iamAccount)
          .submitAttestations([multiAttestationRequests]);
      } catch (e: any) {
        expect(e.message).to.include(
          "Only authorized verifiers can call this function"
        );
      }
    });

    it("Should fail when non-owner tries to add a verifier", async function () {
      try {
        await gitcoinAttester
          .connect(iamAccount)
          .addVerifier(recipient.address);
      } catch (e: any) {
        expect(e.message).to.include("Ownable: caller is not the owner");
      }
    });

    it("Should fail when non-owner tries to remove a verifier", async function () {
      try {
        await gitcoinAttester.connect(iamAccount).removeVerifier(owner.address);
      } catch (e: any) {
        expect(e.message).to.include("Ownable: caller is not the owner");
      }
    });

    it("Should allow owner add and remove verifier", async function () {
      const addTx = await gitcoinAttester
        .connect(owner)
        .addVerifier(recipient.address);
      addTx.wait();

      expect(await gitcoinAttester.verifiers(recipient.address)).to.equal(true);

      const removeTx = await gitcoinAttester
        .connect(owner)
        .removeVerifier(recipient.address);
      removeTx.wait();

      expect(await gitcoinAttester.verifiers(recipient.address)).to.equal(
        false
      );
    });

    it("Should revert when adding an existing verifier", async function () {
      const tx = await gitcoinAttester
        .connect(owner)
        .addVerifier(recipient.address);
      tx.wait();

      expect(await gitcoinAttester.verifiers(recipient.address)).to.equal(true);

      try {
        await gitcoinAttester.connect(owner).addVerifier(recipient.address);
      } catch (e: any) {
        expect(e.message).to.include("Verifier already added");
      }
    });

    it("Should revert when remove a verifier not in the allow-list", async function () {
      try {
        await gitcoinAttester.connect(owner).removeVerifier(iamAccount.address);
      } catch (e: any) {
        console.log(e.message);
        expect(e.message).to.include("Verifier does not exist");
      }
    });
  });
});
