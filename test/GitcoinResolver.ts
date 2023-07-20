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
import { Provider } from "@ethersproject/abstract-provider";
import { Signer } from "ethers";

const { utils } = ethers;

type Stamp = {
  provider: string;
  stampHash: string;
};

const GITCOIN_VCS_SCHEMA =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";

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
  mockEasAccount: any,
  gitcoinResolver: GitcoinResolver,
  eas: EAS,
  gitcoinAttester: GitcoinAttester;

  before(async function() {
    const [
      ownerAccount,
      otherAccount,
      recipientAccount,
      mockEasContractAccount,
    ] = await ethers.getSigners();
    
    owner = ownerAccount;
    iamAccount = otherAccount;
    recipient = recipientAccount;
    mockEasAccount = mockEasContractAccount;
  
    const schemaRegistryContractAddress = "0xA7b39296258348C78294F95B872b282326A97BDF";
    const schemaRegistry = new SchemaRegistry(schemaRegistryContractAddress);

    const GitcoinAttester = await ethers.getContractFactory(
      "GitcoinAttester"
    );
    gitcoinAttester = await GitcoinAttester.connect(owner).deploy();

    // Initialize the sdk with the address of the EAS Schema contract address
    eas = new EAS(mockEasAccount.address);

    // Connects an ethers style provider/signingProvider to perform read/write functions.
    // MUST be a signer to do write operations!
    eas.connect(owner);

    const GitcoinResolver = await ethers.getContractFactory(
      "GitcoinResolver"
    );
    gitcoinResolver = await GitcoinResolver.connect(owner).deploy(
      mockEasAccount.address,
      gitcoinAttester.address
    );
  
    await gitcoinResolver.deployed();

    schemaRegistry.connect(owner);
  
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
    
        const attestResult = await gitcoinResolver.connect(mockEasAccount).attest(attestation);
        
        const { events } = await attestResult.wait();

        events?.forEach(async (event) => {
          expect(event).to.equal("PassportAdded");
        });
        
        const attestationUID = await gitcoinResolver.passports(recipient.address);
        
        expect(attestationUID).to.equal(uid);
      });
    });
  });

  // describe("GitcoinResolver", function () {
    // it("Should process attestations correctly", async function () {
    //   const [owner, verifier, attester, recipient] = await ethers.getSigners();
  
    //   const EAS = await ethers.getContractAt("EAS", EAS_CONTRACT_ADDRESS);
    //   const GitcoinAttester = await ethers.getContractAt("GitcoinAttester", gitcoinAttester.address);
  
    //   // Add a verifier
    //   await GitcoinAttester.connect(owner).addVerifier(verifier.address);
    //   expect(await GitcoinAttester.verifiers(verifier.address)).to.equal(true);

  
    //   // AttestationRequest
    //   const attestationRequest = {
    //     recipient: recipient.address,
    //     expirationTime: NO_EXPIRATION,
    //     revocable: true,
    //     data: encodedData,
    //     refUID: ZERO_BYTES32,
    //     value: 0,
    //   };
  
    //   // Create a MultiAttestationRequest
    //   const multiAttestationRequests = {
    //     schema: GITCOIN_VCS_SCHEMA,
    //     data: [attestationRequest, attestationRequest, attestationRequest]
    //   };
  
    //   // Submit attestations
    //   const tx = await GitcoinAttester.connect(verifier).submitAttestations([multiAttestationRequests]);

    //   const result = await tx.wait();

    //   console.log(result);
      
  
    //   expect(result.events?.length).to.equal(
    //     multiAttestationRequests.data.length
    //   );
    // });
//   });
// });


//     // it("should make multiple attestations", async function() {
//     //   const attester = gitcoinAttester.address;
//     //   const uid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
//     //   const attestation = {
//     //     uid,
//     //     schema: "0",
//     //     time: "0",
//     //     expirationTime: NO_EXPIRATION,
//     //     revocationTime: "0",
//     //     refUID: ZERO_BYTES32,
//     //     recipient,
//     //     attester,
//     //     revocable: true,
//     //     data: [],
//     //   };

//     //   expect(gitcoinResolver.connect(EAS_CONTRACT_ADDRESS).multiAttest([attestation, attestation, attestation], []));
//     // });

//     // it("should revert when a non-allowed address attempts to make any attestation", async function(){
//     //   const attester = gitcoinAttester.address;
//     //   const uid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
//     //   const attestation = {
//     //     uid,
//     //     schema: "0",
//     //     time: "0",
//     //     expirationTime: NO_EXPIRATION,
//     //     revocationTime: "0",
//     //     refUID: ZERO_BYTES32,
//     //     recipient,
//     //     attester,
//     //     revocable: true,
//     //     data: [],
//     //   };


//     //   expect(gitcoinResolver.connect(iamAccount).attest(attestation));
//     //   expect(gitcoinResolver.connect(iamAccount).attest(attestation)).to.be.revertedWith("Only EAS contract can call this function");
//     // });
//     // it("should revert if an address other than the Gitcoin attester attempts to make an attestation", async function() {

//     // });
//   });

//   // Add case for the EAS contract verifying that a user can revoke their attestation
//   // describe("Revocations", function() {
//   //   it("should make 1 revocation", async function() {

//   //   });

//   //   it("Should make multiple revocations", async function() {

//   //   });
//   // });
// });
