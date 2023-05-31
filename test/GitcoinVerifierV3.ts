import { ethers } from "hardhat";
import { expect } from "chai";
import { easEncodeData, Stamp } from "./GitcoinAttester";
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

import { providers } from "./providers";

const { BigNumber, utils } = ethers;

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

const EAS_CONTRACT_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
const GITCOIN_VC_SCHEMA =
  "0x0da70a07d544fd0fa997475a444232a6bb80d976a0eaf481bf93fbb5401781d4";

const fee1 = utils.parseEther("0.001").toHexString();
const fee1Less1Wei = utils.parseEther("0.000999999999999999").toHexString();
const fee2 = utils.parseEther("0.002").toHexString();

const badStampHash = utils.keccak256(utils.toUtf8Bytes("badStampHash"));

const num_stamps_to_write_on_chain =
  Number.parseInt(process.env.NUM_STAMPS_TO_WRITE_ON_CHAIN) || 1;

const passportTypes = {
  Stamp: [{ name: "encodedData", type: "bytes" }],
  Passport: [
    { name: "stamps", type: "Stamp[]" },
    { name: "recipient", type: "address" },
    { name: "expirationTime", type: "uint64" },
    { name: "revocable", type: "bool" },
    { name: "refUID", type: "bytes32" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "fee", type: "uint256" },
  ],
};

describe("GitcoinVerifier", function () {
  this.beforeAll(async function () {
    const [owner, iamAccount, recipientAccount] = await ethers.getSigners();
    this.iamAccount = iamAccount;
    this.recipientAccount = recipientAccount;

    // Deploy GitcoinAttester
    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
    this.gitcoinAttester = await GitcoinAttester.deploy();
    await this.gitcoinAttester.setEASAddress(EAS_CONTRACT_ADDRESS);

    // Deploy GitcoinVerifier
    const GitcoinVerifierV3 = await ethers.getContractFactory(
      "GitcoinVerifierV3"
    );
    this.gitcoinVerifier = await GitcoinVerifierV3.deploy(
      this.gitcoinAttester.address
    );

    // Add verifier to GitcoinAttester allow-list
    const tx = await this.gitcoinAttester.addVerifier(
      this.gitcoinVerifier.address
    );
    await tx.wait();
  });

  this.beforeEach(async function () {});

  describe("GitcoinVerifier - test different schemas", function () {
    type Passport = {
      stamps: Stamp[];
    };

    const getRandomInt = (max: number) => {
      return Math.floor(Math.random() * max);
    };

    const getOnChainPassport = (passport: Passport) => {
      const schemaEncoder = new SchemaEncoder(
        "bytes32[] providers, bytes32[] hashes"
      );

      let hashes = passport.stamps.map((stamp) => {
        return utils.keccak256(utils.toUtf8Bytes(stamp.stampHash));
      });

      const numProviderUint256 = Math.floor((providers.length - 1) / 256) + 1;
      const numProviderUint = numProviderUint256 * 32;
      let providersPayload = new Uint8Array(numProviderUint);
      let providersPayloadBytes32: string[] = [];

      passport.stamps.map((stamp) => {
        const idx = providers.findIndex((provider) => {
          return provider === stamp.provider;
        });
        const providersPayloadIdx = idx >> 8; // divide by 8
        const providersPayloadBitIdx = idx & 0b111; // reminder of division by 8
        providersPayload[providersPayloadIdx] |= 256 >> providersPayloadBitIdx; // set the bit coresponding to the proider position to 1
      });

      // Create theh array of bytes32 values
      for (let i = 0; i < numProviderUint256; i++) {
        providersPayloadBytes32.push(
          ethers.utils.hexlify(providersPayload.slice(i * 32, (i + 1) * 32))
        );
      }

      const encodedData = schemaEncoder.encodeData([
        {
          name: "providers",
          value: providersPayloadBytes32,
          type: "bytes32[]",
        },
        { name: "hashes", value: hashes, type: "bytes32[]" }, // TODO decode hash here
      ]);

      const ret = {
        hashes,
        providers: providersPayloadBytes32,
      };
      console.log("ret", ret);
      return ret;
    };

    it("should write `NUM_STAMPS_TO_WRITE_ON_CHAIN` stamps passport on-chain", async function () {
      const stamps = [];
      for (let j = 0; j < num_stamps_to_write_on_chain; j++) {
        const provider = providers[getRandomInt(providers.length)];
        stamps.push({
          provider,
          stampHash: "0xsome_stamph_ash_" + provider,
        });
      }

      const multiAttestation = await this.gitcoinVerifier.multiAttest(
        getOnChainPassport({ stamps })
      );

      const receipt = await multiAttestation.wait();
      expect(receipt.status).to.equal(1);
      // console.log("receipt", receipt);
      // expect(receipt.logs.length).to.equal(
      //   num_stamps_to_write_on_chain
      // );
      // receipt.logs.forEach((retValue: unknown) => {
      //   console.log("====> retValue: ", retValue);
      // });
    });
  });
});
