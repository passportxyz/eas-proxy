import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect, util } from "chai";
import { ethers } from "hardhat";
import {
  EAS,
  SchemaEncoder,
  ZERO_BYTES32,
  NO_EXPIRATION,
  MultiRevocationRequest,
} from "@ethereum-attestation-service/eas-sdk";
import { GitcoinAttester } from "../typechain-types";

const { Interface } = ethers;

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
  let providerValue = ethers.keccak256(ethers.toUtf8Bytes(stamp.provider));

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

describe.only("GitcoinAttester", function () {
  // TODO: move tests out of "Deployment" describe block
  let gitcoinAttester: any,
    eas: any,
    easFactory: any,
    EASContractAddress: string,
    owner: any,
    iamAccount: any,
    recipient: any,
    mockVerifier: any,
    nonOwnerOrVerifier: any;

  this.beforeAll(async function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
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
      const [
        ownerAccount,
        otherAccount,
        recipientAccount,
        mockVerifierAccount,
        nonOwnerOrVerifierAccount,
        easDeployer,
      ] = await ethers.getSigners();

      owner = ownerAccount;
      iamAccount = otherAccount;
      recipient = recipientAccount;
      mockVerifier = mockVerifierAccount;
      nonOwnerOrVerifier = nonOwnerOrVerifierAccount;

      const GitcoinAttester = await ethers.getContractFactory(
        "GitcoinAttester"
      );
      gitcoinAttester = await GitcoinAttester.connect(owner).deploy();

      const provider = ethers.getDefaultProvider(1);

      const schemaRegistryFactory = await ethers.getContractFactory(
        "SchemaRegistry"
      );
      const schemaRegistry = await schemaRegistryFactory.deploy();

      easFactory = await ethers.getContractFactory("EAS");
      eas = await easFactory.deploy(await schemaRegistry.getAddress());
    }

    await loadFixture(deployGitcoinAttester);
  });
  describe("Attestations", function () {
    it("Should write multiple attestations", async function () {
      await gitcoinAttester.setEASAddress(EASContractAddress);

      const tx = await gitcoinAttester.addVerifier(owner.address);
      await tx.wait();

      const resultTx = await gitcoinAttester.submitAttestations([
        multiAttestationRequests,
      ]);

      const result = await resultTx.wait();

      expect(result.logs?.length).to.equal(
        multiAttestationRequests.data.length
      );
    });

    it("should revert when a non allowed address attempts to write attestations", async function () {
      await gitcoinAttester.setEASAddress(EASContractAddress);
      await expect(
        gitcoinAttester
          .connect(iamAccount)
          .submitAttestations([multiAttestationRequests])
      ).to.be.revertedWith("Only authorized verifiers can call this function");
    });

    it("should revert when non-owner tries to add a verifier", async function () {
      await expect(
        gitcoinAttester.connect(iamAccount).addVerifier(recipient.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert when non-owner tries to remove a verifier", async function () {
      await expect(
        gitcoinAttester.connect(iamAccount).removeVerifier(owner.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow owner to add and remove verifier", async function () {
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

      await expect(
        gitcoinAttester.connect(owner).addVerifier(recipient.address)
      ).to.be.revertedWith("Verifier already added");
    });

    it("Should revert when removing a verifier not in the allow-list", async function () {
      await expect(
        gitcoinAttester.connect(owner).removeVerifier(iamAccount.address)
      ).to.be.revertedWith("Verifier does not exist");
    });
  });
  describe("Revocation", function () {
    let multiRevocationRequest: MultiRevocationRequest[] = [];
    beforeEach(async function () {
      multiRevocationRequest = [];

      const tx = await gitcoinAttester
        .connect(owner)
        .submitAttestations([multiAttestationRequests]);
      const attestationResult = await tx.wait();

      // const easInterface = new Interface(eas);

      attestationResult.logs?.forEach((log) => {
        const decodedLog = easFactory.interface.parseLog(log);
        const args = decodedLog?.args;
        if (args) {
          const { schema, uid } = decodedLog.args;
          const value = BigInt(0);
          const existingRevocationRequest = multiRevocationRequest.find(
            (r) => r.schema === schema
          );
          if (existingRevocationRequest) {
            existingRevocationRequest.data.push({
              uid,
              value,
            });
          } else {
            multiRevocationRequest.push({
              schema,
              data: [
                {
                  uid,
                  value,
                },
              ],
            });
          }
        }
      });
    });
    it("should allow owner to revoke attestations", async function () {
      const revocationTx = await gitcoinAttester
        .connect(owner)
        .revokeAttestations(multiRevocationRequest);

      const revocationResult = await revocationTx.wait();

      revocationResult.logs?.forEach(async (log, i) => {
        const easInterface = easFactory.interface.parseLog(log);
        expect(easInterface?.args).to.not.be.undefined;
        const schema = easInterface?.args.schema;
        const uid = easInterface?.args.uid;
        expect(schema).to.equal(multiRevocationRequest[0].schema);
        expect(uid).to.equal(multiRevocationRequest[0].data[i].uid);
        // check that each attestation was revoked by uid
        const revokedAttestation = await eas.connect(owner).getAttestation(uid);
        expect(revokedAttestation.revocationTime).to.not.equal(0);
      });
    });
    it("should allow verifier to revoke attestations", async function () {
      const tx = await gitcoinAttester.addVerifier(mockVerifier.address);
      const addVerifierRecieptc = await tx.wait();
      const revocationTx = await gitcoinAttester
        .connect(mockVerifier)
        .revokeAttestations(multiRevocationRequest);
      const revocationResult = await revocationTx.wait();
      revocationResult.logs?.forEach(async (log, i) => {
        const parsedLogs = eas.contract.interface.parseLog(log);
        const { schema, uid } = parsedLogs.args;
        expect(schema).to.equal(multiRevocationRequest[0].schema);
        expect(uid).to.equal(multiRevocationRequest[0].data[i].uid);
        // check that each attestation was revoked by uid
        const revokedAttestation = await eas.connect(owner).getAttestation(uid);
        expect(revokedAttestation.revocationTime).to.not.equal(0);
      });
    });
    it("should not allow non-owner to revoke attestations", async function () {
      await expect(
        gitcoinAttester
          .connect(nonOwnerOrVerifier)
          .revokeAttestations(multiRevocationRequest)
      ).to.be.revertedWith(
        "Only authorized verifiers or owner can call this function"
      );
    });
  });
});
