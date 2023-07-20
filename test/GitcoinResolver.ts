import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EAS,
  SchemaEncoder,
  ZERO_BYTES32,
  NO_EXPIRATION,
  MultiRevocationRequest,
  AttestationRequestData,
  SchemaRegistry,
} from "@ethereum-attestation-service/eas-sdk";
import { GitcoinAttester, GitcoinResolver } from "../typechain-types";

const { utils } = ethers;

type Stamp = {
  provider: string;
  stampHash: string;
};

const GITCOIN_VCS_SCHEMA =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";
const zeroAddress = "0x0000000000000000000000000000000000000000000000000000000000000000";

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

describe("GitcoinResolver", function() {
  let owner: any,
  iamAccount: any,
  recipient: any,
  mockEas: any,
  nonOwnerOrVerifier: any,
  gitcoinResolver: GitcoinResolver,
  eas: EAS,
  gitcoinAttester: GitcoinAttester;

  before(async function() {
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
  
    // Sepolia registry contract from env variables
    const schemaRegistryContractAddress = "0xA7b39296258348C78294F95B872b282326A97BDF";
    const schemaRegistry = new SchemaRegistry(schemaRegistryContractAddress);

    const GitcoinAttester = await ethers.getContractFactory(
      "GitcoinAttester"
    );
    gitcoinAttester = await GitcoinAttester.connect(owner).deploy();

    // Initialize the sdk with the address of the EAS Schema contract address
    eas = new EAS(mockEas.address);

    // Connects an ethers style provider/signingProvider to perform read/write functions.
    // MUST be a signer to do write operations!
    eas.connect(owner);

    const GitcoinResolver = await ethers.getContractFactory(
      "GitcoinResolver"
    );
    gitcoinResolver = await GitcoinResolver.connect(owner).deploy(
      mockEas.address,
      gitcoinAttester.address
    );
  
    await gitcoinResolver.deployed();

    schemaRegistry.connect(owner);
  
    // add gitcoin schema
    const schema = "uint256 eventId, uint8 voteIndex";
    const resolverAddress = gitcoinResolver.address;
    const revocable = true;
  
    const transaction = await schemaRegistry.register({
      schema,
      resolverAddress,
      revocable,
    });
    
    // Optional: Wait for transaction to be validated
    await transaction.wait();
  });

  describe("Attestations", function() {
    it("should make 1 attestation", async function() {
      const attester = gitcoinAttester.address;
      const uid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
      const attestation = {
        uid,
        schema: GITCOIN_VCS_SCHEMA,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester,
        revocable: true,
        data: encodedData,
      };
  
      const attestResult = await gitcoinResolver.connect(mockEas).attest(attestation);
      
      const { events } = await attestResult.wait();

      events?.forEach(async (event) => {
        expect(event).to.equal("PassportAdded");
      });
      
      const attestationUID = await gitcoinResolver.passports(recipient.address);
      
      expect(attestationUID).to.equal(uid);
    });

    it("should make multiple attestations", async function() {
      const attester = gitcoinAttester.address;
      const uid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
      const attestation = {
        uid,
        schema: GITCOIN_VCS_SCHEMA,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester,
        revocable: true,
        data: encodedData,
      };
  
      const result = await gitcoinResolver.connect(mockEas).multiAttest([attestation, attestation, attestation], []);
      const { events } = await result.wait();

      events?.forEach(async (event) => {
        expect(event.event).to.equal("PassportAdded");
        expect(event.args?.recipient).to.equal(recipient.address);
        expect(event.args?.recipientUid).to.equal(recipient.address);
      });
    });
  
    it("should revert when a non-allowed address attempts to make any attestation", async function(){
      const attester = gitcoinAttester.address;
      const uid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
      const attestation = {
        uid,
        schema: GITCOIN_VCS_SCHEMA,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester,
        revocable: true,
        data: encodedData,
      };
  
      await expect(gitcoinResolver.connect(iamAccount).attest(attestation)).to.be.revertedWith("Only EAS contract can call this function");
    });

    it("should revert if an address other than the Gitcoin attester attempts to make an attestation", async function() {
      const uid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
      const attestation = {
        uid,
        schema: GITCOIN_VCS_SCHEMA,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester: nonOwnerOrVerifier.address,
        revocable: true,
        data: encodedData,
      };

      await expect(gitcoinResolver.connect(mockEas).attest(attestation)).to.be.revertedWith("Only the the Gitcoin Attester can make attestations");
    });
  });
  //   // Add case for the EAS contract verifying that a user can revoke their attestation
    describe("Revocations", function() {
      it("should make 1 revocation", async function() {
        const attester = gitcoinAttester.address;
        const uid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
        const attestation = {
          uid,
          schema: GITCOIN_VCS_SCHEMA,
          time: NO_EXPIRATION,
          expirationTime: NO_EXPIRATION,
          revocationTime: NO_EXPIRATION,
          refUID: ZERO_BYTES32,
          recipient: recipient.address,
          attester,
          revocable: true,
          data: encodedData,
        };
    
        const attestResult = await gitcoinResolver.connect(mockEas).revoke(attestation);
        
        const { events } = await attestResult.wait();

        events?.forEach(async (event) => {
          expect(event).to.equal("PassportRemoved");
        });
        
        const revoked = await gitcoinResolver.passports(recipient.address);
        
        expect(revoked).to.equal(zeroAddress);
      });
  
      it("Should make multiple revocations", async function() {
        const attester = gitcoinAttester.address;
        const uid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
        const attestation = {
          uid,
          schema: GITCOIN_VCS_SCHEMA,
          time: NO_EXPIRATION,
          expirationTime: NO_EXPIRATION,
          revocationTime: NO_EXPIRATION,
          refUID: ZERO_BYTES32,
          recipient: recipient.address,
          attester,
          revocable: true,
          data: encodedData,
        };
    
        const result = await gitcoinResolver.connect(mockEas).multiRevoke([attestation, attestation, attestation], []);
        const { events } = await result.wait();
  
        events?.forEach(async (event) => {
          expect(event.event).to.equal("PassportRemoved");
          expect(event.args?.recipient).to.equal(recipient.address);
          expect(event.args?.recipientUid).to.equal(recipient.address);
        });
      });
    });
  });
