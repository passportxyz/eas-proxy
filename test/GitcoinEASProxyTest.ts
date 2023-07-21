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
import { GitcoinAttester, GitcoinResolver, GitcoinVerifier } from "../typechain-types";
import { easEncodeScore, easEncodeStamp } from "./GitcoinAttester";

const { utils } = ethers;

type Stamp = {
  provider: string;
  stampHash: string;
};

const GITCOIN_VCS_SCHEMA =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";
const EAS_CONTRACT = "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458";

const encodedData = easEncodeStamp({
  provider: "TestProvider",
  stampHash: "234567890",
});

const passportTypes = {
  AttestationRequestData: [
    { name: "recipient", type: "address" },
    { name: "expirationTime", type: "uint64" },
    { name: "revocable", type: "bool" },
    { name: "refUID", type: "bytes32" },
    { name: "data", type: "bytes" },
    { name: "value", type: "uint256" },
  ],
  MultiAttestationRequest: [
    { name: "schema", type: "bytes32" },
    { name: "data", type: "AttestationRequestData[]" },
  ],
  PassportAttestationRequest: [
    { name: "multiAttestationRequest", type: "MultiAttestationRequest[]" },
    { name: "nonce", type: "uint256" },
    { name: "fee", type: "uint256" },
  ],
};

const googleStamp = {
  provider: "Google",
  stampHash: "234567890",
};

const facebookStamp = {
  provider: "Facebook",
  stampHash: "234567891",
};

const twitterStamp = {
  provider: "Twitter",
  stampHash: "234567891",
};

const scorer1Score = {
  score: 100,
  scorer_id: 420,
};

const scorer2Score = {
  score: 200,
  scorer_id: 240,
};

const fee1 = utils.parseEther("0.001").toHexString();

describe("GitcoinResolver", function() {
  this.beforeAll(async function() {
    const [
      ownerAccount,
      otherAccount,
      recipientAccount,
    ] = await ethers.getSigners();
    
    this.owner = ownerAccount;
    this.iamAccount = otherAccount;
    this.recipient = recipientAccount;

    const GitcoinVerifier = await ethers.getContractFactory(
      "GitcoinVerifier"
    );
    
    const GitcoinAttester = await ethers.getContractFactory(
      "GitcoinAttester"
      );
    this.gitcoinAttester = await GitcoinAttester.connect(this.owner).deploy();

    this.gitcoinVerifier = await GitcoinVerifier.connect(this.owner).deploy(
      this.iamAccount.address,
      this.gitcoinAttester.address
    );

    this.getNonce = async (address: string) => {
      return await this.gitcoinVerifier.recipientNonces(address);
    };

    this.passport = {
      multiAttestationRequest: [
        {
          schema: GITCOIN_VCS_SCHEMA,
          data: [
            {
              recipient: this.recipient.address,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeStamp(googleStamp),
              value: 0,
            },
            {
              recipient: this.recipient.address,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeStamp(facebookStamp),
              value: 0,
            },
          ],
        },
        {
          schema: GITCOIN_VCS_SCHEMA,
          data: [
            {
              recipient: this.recipient.address,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer1Score),
              value: 0,
            },
            {
              recipient: this.recipient.address,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer2Score),
              value: 0,
            },
            {
              recipient: this.recipient.address,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer2Score),
              value: 0,
            },
          ],
        },
      ],
      nonce: await this.getNonce(this.recipient.address),
      fee: fee1,
    };
  
    const schemaRegistryContractAddress = process.env.SEPOLIA_SCHEMA_REGISTRY_ADDRESS || "";
    const schemaRegistry = new SchemaRegistry(schemaRegistryContractAddress);

    const chainId = await this.iamAccount.getChainId();

    this.domain = {
      name: "GitcoinVerifier",
      version: "1",
      chainId,
      verifyingContract: this.gitcoinVerifier.address,
    };

    this.signature = await this.iamAccount._signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );

    const recoveredAddress = ethers.utils.verifyTypedData(
      this.domain,
      passportTypes,
      this.passport,
      this.signature
    );

    // Initialize the sdk with the address of the EAS Schema contract address
    this.eas = new EAS(EAS_CONTRACT);

    // Connects an ethers style provider/signingProvider to perform read/write functions.
    // MUST be a signer to do write operations!
    this.eas.connect(this.owner);

    const GitcoinResolver = await ethers.getContractFactory(
      "GitcoinResolver"
    );
    this.gitcoinResolver = await GitcoinResolver.connect(this.owner).deploy(
      EAS_CONTRACT,
      this.gitcoinAttester.address
    );
  
    await this.gitcoinResolver.deployed();

    schemaRegistry.connect(this.owner);
  
    // add gitcoin schema
    const schema = "uint256 eventId, uint8 voteIndex";
    const resolverAddress = this.gitcoinResolver.address;
    const revocable = true;
  
    const transaction = await schemaRegistry.register({
      schema,
      resolverAddress,
      revocable,
    });
    
    // Optional: Wait for transaction to be validated
    await transaction.wait();
  });

  this.beforeEach(async function () {
    this.passport.nonce = await this.gitcoinVerifier.recipientNonces(
      this.passport.multiAttestationRequest[0].data[0].recipient
    );
  });

  describe("Gitcoin EAS Proxy", function () {
    it("should successfully move through the entire EAS proxy flow", async function () {
      // Add a verifier
      const verificationResult = await this.gitcoinAttester.connect(this.owner).addVerifier(this.gitcoinVerifier.address);
      const verificationWaitResult = await verificationResult.wait();
      
      expect(await this.gitcoinAttester.verifiers(this.gitcoinVerifier.address)).to.equal(true);
  
      // AttestationRequest
      const attestationRequest = {
        recipient: this.recipient.address,
        expirationTime: NO_EXPIRATION,
        revocable: true,
        data: encodedData,
        refUID: ZERO_BYTES32,
        value: 0,
      };

      const { v, r, s } = ethers.splitSignature(this.signature);
  
      // Submit attestations
      const tx = await this.gitcoinVerifier.verifyAndAttest(this.passport, v, r, s, {
        value: fee1,
      });

      const result = await tx.wait();

      console.log(result);
  
      expect(result.events?.length).to.equal(
        this.passport.data.length
      );
    });
  });
});
