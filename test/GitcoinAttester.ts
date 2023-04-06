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
} from "@ethereum-attestation-service/eas-sdk";

describe("GitcoinAttester", function () {
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
    const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26
    const gitcoinVCSchema =
      "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
    const gitcoinAttester = await GitcoinAttester.deploy();

    const provider = ethers.getDefaultProvider();

    console.log("provider", provider);
    // Initialize the sdk with the address of the EAS Schema contract address
    const eas = new EAS(EASContractAddress);

    // Connects an ethers style provider/signingProvider to perform read/write functions.
    // MUST be a signer to do write operations!
    eas.connect(provider);

    return { gitcoinAttester, eas, gitcoinVCSchema, EASContractAddress };
  }

  describe("Deployment", function () {
    it("Should deploy contract", async function () {
      const { gitcoinAttester, eas, gitcoinVCSchema, EASContractAddress } =
        await loadFixture(deployGitcoinAttester);

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
  });

  it("Should sign attestation data", async function () {
    const { gitcoinAttester, eas, gitcoinVCSchema, EASContractAddress } =
      await loadFixture(deployGitcoinAttester);

    const signers = await ethers.getSigners();
    console.log("signers", signers);
    const signer = signers[0];

    const domain = {
      name: "Gitcoin Attester",
      version: "1",
      chainId: 1,
      verifyingContract: gitcoinAttester.address,
    };

    var types = ATTEST_TYPE;
    const domainData = {
      name: "app",
      version: "1",
      chainId: 3,
      // verifyingContract: cardExchangeContract,
      salt: "0xa222082684812afae4e093416fff16bc218b569abe4db590b6a058e1f2c1cd3e",
    };

    // signer._signTypedData(domain, )
  });
});
