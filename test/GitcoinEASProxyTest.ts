import { expect } from "chai";
import { ethers } from "hardhat";
import { EAS, ZERO_BYTES32, NO_EXPIRATION } from "@ethereum-attestation-service/eas-sdk";
import { GitcoinAttester, GitcoinResolver, GitcoinVerifier } from "../typechain-types";
import {
  easEncodeScore,
  easEncodeStamp,
  encodedData,
  gitcoinVCSchema,
} from "./GitcoinAttester";

import {
  googleStamp,
  facebookStamp,
  GITCOIN_SCORE_SCHEMA,
  GITCOIN_STAMP_SCHEMA,
  passportTypes,
  scorer1Score,
  scorer2Score,
  EAS_CONTRACT_ADDRESS,
  fee1,
} from "./GitcoinVerifier";

import { schemaRegistryContractAddress } from "./GitcoinResolver";
import { SCHEMA_REGISTRY_ABI } from "./abi/SCHEMA_REGISTRY_ABI";

describe("GitcoinEASProxy", function() {
  let gitcoinResolver: GitcoinResolver;

  this.beforeAll(async function() {
    const [
      ownerAccount,
      otherAccount,
      recipientAccount
    ] = await ethers.getSigners();
    
    this.owner = ownerAccount;
    this.iamAccount = otherAccount;
    this.recipient = recipientAccount;

    // Deploy GitcoinAttester
    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester", this.owner);
    this.gitcoinAttester = await GitcoinAttester.deploy();
    await this.gitcoinAttester.connect(this.owner).initialize();
    this.gitcoinAttesterAddress = await this.gitcoinAttester.getAddress();
    
    // Deploy GitcoinVerifier
    const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier", this.owner);
    this.gitcoinVerifier = await GitcoinVerifier.deploy();
    
    await this.gitcoinVerifier
      .connect(this.owner)
      .initialize(
        await this.iamAccount.getAddress(),
        await this.gitcoinAttester.getAddress()
      );
      
    this.eas = new EAS(EAS_CONTRACT_ADDRESS);
    await this.gitcoinAttester.setEASAddress(EAS_CONTRACT_ADDRESS);

    const chainId = await ethers.provider.getNetwork().then((n) => n.chainId);

    this.domain = {
      name: "GitcoinVerifier",
      version: "1",
      chainId,
      verifyingContract: await this.gitcoinVerifier.getAddress(),
    };

    this.getNonce = async (address: string) => {
      return await this.gitcoinVerifier.recipientNonces(address);
    };

    this.passport = {
      multiAttestationRequest: [
        {
          schema: GITCOIN_STAMP_SCHEMA,
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
          schema: GITCOIN_SCORE_SCHEMA,
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

    this.getOtherPassport = async () => {
      return {
        multiAttestationRequest: [
          {
            schema: GITCOIN_STAMP_SCHEMA,
            data: [
              {
                recipient: this.recipient.address,
                expirationTime: NO_EXPIRATION,
                revocable: true,
                refUID: ZERO_BYTES32,
                data: easEncodeStamp(googleStamp),
                value: 0,
              },
            ],
          },
          {
            schema: GITCOIN_SCORE_SCHEMA,
            data: [
              {
                recipient: this.recipient.address,
                expirationTime: NO_EXPIRATION,
                revocable: true,
                refUID: ZERO_BYTES32,
                data: easEncodeScore(scorer1Score),
                value: 0,
              },
            ],
          },
        ],
        nonce: await this.getNonce(this.recipient.address),
        fee: fee1,
      };
    };

    this.signature = await this.iamAccount.signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );

    // Deploy GitcoinResolver
    const GitcoinResolver = await ethers.getContractFactory("GitcoinResolver", this.owner);
    gitcoinResolver = await GitcoinResolver.deploy();
    await gitcoinResolver.connect(this.owner).initialize(
      EAS_CONTRACT_ADDRESS,
      await this.gitcoinAttester.getAddress()
    );

    // Register schema for resolver
    const schemaRegistry = new ethers.Contract(
      schemaRegistryContractAddress,
      SCHEMA_REGISTRY_ABI,
      this.owner
    );

    this.uid = ethers.keccak256(ethers.toUtf8Bytes("test"));

    this.validAttestation = {
      uid: this.uid,
      schema: gitcoinVCSchema,
      time: NO_EXPIRATION,
      expirationTime: NO_EXPIRATION,
      revocationTime: NO_EXPIRATION,
      refUID: ZERO_BYTES32,
      recipient: this.recipient.address,
      attester: this.gitcoinAttesterAddress,
      revocable: true,
      data: encodedData,
    };

    const schema = "uint256 eventId, uint8 voteIndex";
    const resolverAddress = await gitcoinResolver.getAddress();
    const revocable = true;

    const transaction = await schemaRegistry.register(
      schema,
      resolverAddress,
      revocable
    );

    await transaction.wait();
  });

  this.beforeEach(async function () {
    this.passport.nonce = await this.gitcoinVerifier.recipientNonces(
      this.passport.multiAttestationRequest[0].data[0].recipient
    );
  });

  describe.only("GitcoinEASProxy", function () {
    it("should move through the entire Gitcoin EAS proxy attestation flow", async function () {
      // Add a verifier
      const verificationResult = await this.gitcoinAttester.connect(this.owner).addVerifier(await this.gitcoinVerifier.getAddress());
      expect(verificationResult)
        .to.emit(this.gitcoinAttester, "VerifierAdded")
        .withArgs(await this.gitcoinVerifier.getAddress()
      );
      await verificationResult.wait();
      
      const { v, r, s } = ethers.Signature.from(this.signature);
  
      // Submit attestations
      const verifiedPassport = await this.gitcoinVerifier.verifyAndAttest(this.passport, v, r, s, {
        value: fee1,
      });
      
      expect(verifiedPassport)
        .to.emit(gitcoinResolver, "PassportAdded")
        .withArgs(this.validAttestation.recipient, this.uid);
      
      const receipt = await verifiedPassport.wait();
      expect(receipt.status).to.equal(1);
    });

    it("should move through the entire Gitcoin EAS proxy revocation flow", async function () {
    });
  });
});
