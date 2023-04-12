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

const googleStamp = {
  provider: "Google",
  stampHash: "234567890",
  expirationDate: "2023-12-31",
};

const facebookStamp = {
  provider: "Facebook",
  stampHash: "234567891",
  expirationDate: "2023-12-31",
};

describe("GitcoinAttester", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.

  describe("Deployment", function () {
    let gitcoinAttester: GitcoinAttester, eas, gitcoinVCSchema: string, EASContractAddress: string, iamAccount: any, verifier: any, recipient: any;

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
        gitcoinVCSchema =
          "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";
    
        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount, recipientAccount] = await ethers.getSigners();

        iamAccount = otherAccount;
        recipient = recipientAccount;
    
        const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
        gitcoinAttester = await GitcoinAttester.deploy(iamAccount.address);
    
        const provider = ethers.getDefaultProvider();
    
        console.log("provider", provider);
        // Initialize the sdk with the address of the EAS Schema contract address
        eas = new EAS(EASContractAddress);
    
        // Connects an ethers style provider/signingProvider to perform read/write functions.
        // MUST be a signer to do write operations!
        eas.connect(provider);

        const verifierFactory = await ethers.getContractFactory("Verifier");
        verifier = await verifierFactory.deploy(iamAccount.address);
      }

      await loadFixture(deployGitcoinAttester);
    });

    it("should verify signature and make attestations for each stamp", async function () {
      const chainId = await iamAccount.getChainId();

      const domain = {
        name: "Attester",
        version: "1",
        chainId,
        verifyingContract: gitcoinAttester.address,
      };

      const types = {
        Stamp: [
          { name: "provider", type: "string" },
          { name: "stampHash", type: "string" },
          { name: "expirationDate", type: "string" }
        ],
        Passport: [
          { name: "stamps", type: "Stamp[]" },
          { name: "recipient", type: "address" }
        ]
      };

      const passport = {
        stamps: [
          {
            provider: googleStamp.provider,
            stampHash: googleStamp.stampHash,
            expirationDate: googleStamp.expirationDate,
          },
          {
            provider: facebookStamp.provider,
            stampHash: facebookStamp.stampHash,
            expirationDate: facebookStamp.expirationDate,
          }
        ],
        recipient: recipient.address
      };

      const signature = await iamAccount._signTypedData(domain, types, passport);

      const { v, r, s } = ethers.utils.splitSignature(signature);

      const verifiedStamp = await gitcoinAttester.addPassportWithSignature(gitcoinVCSchema, passport, v, r, s);
    });

    it.skip("Should write multiple attestations", async function () {

      await gitcoinAttester.setEASAddress(EASContractAddress);

      const schemaEncoder = new SchemaEncoder("string provider, string hash");
      const encodedData = schemaEncoder.encodeData([
        { name: "provider", value: "TestProvider", type: "string" },
        { name: "hash", value: "234567890", type: "string" },
      ]);

      const attestationRequest = {
        recipient: "0x4A13F4394cF05a52128BdA527664429D5376C67f",
        // Unix timestamp of when attestation expires. (0 for no expiration)
        expirationTime: NO_EXPIRATION,
        revocable: true,
        data: encodedData,
        refUID: ZERO_BYTES32,
        value: 0,
      };

      const resultTx = await gitcoinAttester.addPassport(gitcoinVCSchema, [
        attestationRequest,
        attestationRequest,
        attestationRequest,
      ]);
      console.log("resultTx", resultTx);
      const result = await resultTx.wait();
      console.log("result", result);
      console.log("result.logs", result.logs);
      console.log("result.logs[0]", result.logs[0]);
      console.log("result.logs[0].data", result.logs[0].data);

      const attestation_1 = await gitcoinAttester.getAttestation(
        result.logs[0].data
      );
      const attestation_2 = await gitcoinAttester.getAttestation(
        result.logs[1].data
      );
      const attestation_3 = await gitcoinAttester.getAttestation(
        result.logs[2].data
      );
      console.log("attestation", attestation_1);
      console.log("attestation", attestation_2);
      console.log("attestation", attestation_3);
      console.log("gitcoinAttester.address", gitcoinAttester.address);
      // expect(await lock.unlockTime()).to.equal(unlockTime);
    });

    it.skip("Should write a passport to the blockchain by providing EIP712 signed array of requests", async function () {
      const signers = await ethers.getSigners();
      console.log("signers", signers);
      const signer = signers[0];
  
      const domain = {
        name: "Gitcoin Attester",
        version: "1",
        chainId: 1,
        verifyingContract: gitcoinAttester.address,
      };
  
      // var types = { ATTEST_PRIMARY_TYPE: ATTEST_TYPE };
      // console.log("types", types);
  
      const schemaEncoder = new SchemaEncoder("string provider, string hash");
      const encodedData = schemaEncoder.encodeData([
        { name: "provider", value: "TestProvider", type: "string" },
        { name: "hash", value: "234567890", type: "string" },
      ]);
  
      const encodeDataBytes = Buffer.from(encodedData.substring(2), "hex");
      // console.log("encodedData", encodedData);
      // console.log("encodeDataBytes", encodeDataBytes);
  
      const attestationRequest = {
        // Unix timestamp of when attestation expires. (0 for no expiration)
        expirationTime: NO_EXPIRATION,
        data: encodeDataBytes,
      };
  
      // const signature = await signer._signTypedData(
      //   domain,
      //   types,
      //   attestationRequest
      // );
      // console.log("signature", signature);
  
      // Next: create a signature for an array of attestations
      const StampAttestationType = [
        { name: "expirationTime", type: "uint64" },
        // { name: "revocable", type: "bool" },   // TODO: we should decide if we want to have this set to true by default ...
        // { name: "refUID", type: "bytes32" },  // TODO: we do not need this for the passport
        { name: "data", type: "bytes" },
      ];
  
      const arrayTypes = {
        StampAttestation: StampAttestationType,
        PassportAttestationRequests: [
          { name: "attestations", type: `StampAttestation[]` },
          { name: "nonce", type: "uint256" },
          { name: "recipient", type: "address" }, // TODO: The recipient will be the same for all attestations / stamps
          // { name: 'schema', type: 'bytes32' },    // TODO: Shall we use the schema here? Or can we skip this?
        ],
      };
  
      const passportStampAttestationRequest = {
        attestations: [
          attestationRequest,
          attestationRequest,
          attestationRequest,
        ],
        nonce: 0,
        recipient: "0x4A13F4394cF05a52128BdA527664429D5376C67f",
      };
  
      const signatureForArray = await signer._signTypedData(
        domain,
        arrayTypes,
        passportStampAttestationRequest
      );
      console.log("signatureForArray", signatureForArray);
      const splitSig = ethers.utils.splitSignature(signatureForArray);
      console.log("splitSig", splitSig);
      const resultTx = await gitcoinAttester.addPassportWithSignature(
        gitcoinVCSchema,
        passportStampAttestationRequest,
        splitSig.v,
        splitSig.r,
        splitSig.s
      );
  
      console.log("resultTx", resultTx);
      const result = await resultTx.wait();
      console.log("result", result);
      console.log("result.logs", result.logs);
      console.log("result.logs[0]", result.logs[0]);
      console.log("result.logs[0].data", result.logs[0].data);
  
      const attestation_1 = await gitcoinAttester.getAttestation(
        result.logs[0].data
      );
      const attestation_2 = await gitcoinAttester.getAttestation(
        result.logs[1].data
      );
      const attestation_3 = await gitcoinAttester.getAttestation(
        result.logs[2].data
      );
      console.log("attestation", attestation_1);
      console.log("attestation", attestation_2);
      console.log("attestation", attestation_3);
      console.log("gitcoinAttester.address", gitcoinAttester.address);
      // Read back the attestations written to the chain
    });
  });

});
