import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EAS,
  SchemaEncoder,
  ZERO_BYTES32,
  NO_EXPIRATION,
  MultiRevocationRequest,
} from "@ethereum-attestation-service/eas-sdk";
import { GitcoinAttester, GitcoinResolver } from "../typechain-types";

const EAS_CONTRACT_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
const GITCOIN_VCS_SCHEMA =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";

describe("GitcoinResolver", function() {
  let owner: any,
    iamAccount: any,
    recipient: any,
    gitcoinResolver: GitcoinResolver,
    eas,
    // let registry: SchemaRegistry,
    gitcoinAttester: GitcoinAttester;

  before(async function() {
    const [
      ownerAccount,
      otherAccount,
      recipientAccount,
    ] = await ethers.getSigners();
    
    owner = ownerAccount;
    iamAccount = otherAccount;
    recipient = recipientAccount;
  });
  
  this.beforeAll(async function() {

    
    async function deployGitcoinResolver() {
      const GitcoinAttester = await ethers.getContractFactory(
        "GitcoinAttester"
      );
      gitcoinAttester = await GitcoinAttester.connect(owner).deploy();
      
      const GitcoinResolver = await ethers.getContractFactory(
        "GitcoinResolver"
      );
      gitcoinResolver = await GitcoinResolver.connect(owner).deploy(
        EAS_CONTRACT_ADDRESS,
        gitcoinAttester.address
      );
      // await gitcoinResolver.deployed()
    }
    await loadFixture(deployGitcoinResolver);
  });
  
  describe("Attestations", function() {
    it("should make 1 attestation", async function() {
      const attester = gitcoinAttester.address;
      const uid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
      const attestation = {
        uid,
        schema: GITCOIN_VCS_SCHEMA,
        time: "0",
        expirationTime: "0",
        revocationTime: "0",
        refUID: "0",
        recipient,
        attester,
        revocable: true,
        data: [],
      };
      
      expect(gitcoinResolver.connect(EAS_CONTRACT_ADDRESS).attest(attestation)).to.equal(true);

      const attestationUID = gitcoinResolver.passports.length;
      console.log(attestationUID);
      
      // expect(await passportAddress).to.equal(uid);

    });

    // it("should make multiple attestations", async function() {
    //   const attester = gitcoinAttester.address;
    //   const uid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
    //   const attestation = {
    //     uid,
    //     schema: "0",
    //     time: "0",
    //     expirationTime: NO_EXPIRATION,
    //     revocationTime: "0",
    //     refUID: ZERO_BYTES32,
    //     recipient,
    //     attester,
    //     revocable: true,
    //     data: [],
    //   };

    //   expect(gitcoinResolver.connect(EAS_CONTRACT_ADDRESS).multiAttest([attestation, attestation, attestation], []));
    // });

    // it("should revert when a non-allowed address attempts to make any attestation", async function(){
    //   const attester = gitcoinAttester.address;
    //   const uid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
    //   const attestation = {
    //     uid,
    //     schema: "0",
    //     time: "0",
    //     expirationTime: NO_EXPIRATION,
    //     revocationTime: "0",
    //     refUID: ZERO_BYTES32,
    //     recipient,
    //     attester,
    //     revocable: true,
    //     data: [],
    //   };


    //   expect(gitcoinResolver.connect(iamAccount).attest(attestation));
    //   expect(gitcoinResolver.connect(iamAccount).attest(attestation)).to.be.revertedWith("Only EAS contract can call this function");
    // });
    it("should revert if an address other than the Gitcoin attester attempts to make an attestation", async function() {

    });
  });

  // Add case for the EAS contract verifying that a user can revoke their attestation
  // describe("Revocations", function() {
  //   it("should make 1 revocation", async function() {

  //   });

  //   it("Should make multiple revocations", async function() {

  //   });
  // });
});
