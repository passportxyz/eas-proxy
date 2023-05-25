import { ethers } from "hardhat";
import { expect } from "chai";
import {
  NO_EXPIRATION,
  ZERO_BYTES32,
} from "@ethereum-attestation-service/eas-sdk";
import { easEncodeData } from "./GitcoinAttester";

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
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";

const fee1 = utils.parseEther("0.001").toHexString();
const fee1Less1Wei = utils.parseEther("0.000999999999999999").toHexString();
const fee2 = utils.parseEther("0.002").toHexString();

const badStampHash = utils.keccak256(utils.toUtf8Bytes("badStampHash"));

const passportTypes = {
  Score: [
    { name: "recipient", type: "address" },
    { name: "expirationTime", type: "uint64" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "stampsHash", type: "bytes32" },
  ],
};

describe("GitcoinScoreVerifier", function () {
  this.beforeAll(async function () {
    const [owner, iamAccount, recipientAccount] = await ethers.getSigners();
    this.iamAccount = iamAccount;
    this.recipientAccount = recipientAccount;

    // Deploy GitcoinAttester
    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
    this.gitcoinAttester = await GitcoinAttester.deploy();
    await this.gitcoinAttester.setEASAddress(EAS_CONTRACT_ADDRESS);

    // Deploy GitcoinVerifier
    const GitcoinVerifier = await ethers.getContractFactory(
      "GitcoinScoreVerifier"
    );
    this.gitcoinVerifier = await GitcoinVerifier.deploy(
      this.iamAccount.address,
      this.gitcoinAttester.address
    );

    // Add verifier to GitcoinAttester allow-list
    const tx = await this.gitcoinAttester.addVerifier(
      this.gitcoinVerifier.address
    );
    await tx.wait();

    const chainId = await this.iamAccount.getChainId();

    this.domain = {
      name: "GitcoinScoreVerifier",
      version: "1",
      chainId,
      verifyingContract: this.gitcoinVerifier.address,
    };

    this.types = passportTypes;

    this.getNonce = async () => {
      return await this.gitcoinVerifier.recipientNonces(
        this.passport.recipient
      );
    };

    this.passport = {
      recipient: this.recipientAccount.address,
      expirationTime: NO_EXPIRATION,
      revocable: true,
      refUID: ZERO_BYTES32,
      value: 0,
      fee: fee1,
    };

    this.getOtherPassport = async () => {
      return {
        stamps: [
          {
            encodedData: easEncodeData(googleStamp),
          },
          {
            encodedData: easEncodeData(twitterStamp),
          },
        ],
        recipient: this.recipientAccount.address,
        expirationTime: NO_EXPIRATION,
        revocable: true,
        refUID: ZERO_BYTES32,
        value: 0,
        fee: fee1,
        nonce: await this.getNonce(),
      };
    };
  });

  this.beforeEach(async function () {
    this.passport.nonce = await this.gitcoinVerifier.recipientNonces(
      this.passport.recipient
    );
  });

  it.only("should verify score", async function () {
    const chainId = await this.iamAccount.getChainId();

    const score = {
      recipient: this.recipientAccount.address,
      expirationTime: NO_EXPIRATION,
      value: 100,
      nonce: await this.getNonce(),
      stampsHash: utils.keccak256("0x" + "00".repeat(16)),
    };

    const signature = await this.iamAccount._signTypedData(
      this.domain,
      this.types,
      score
    );

    const { v, r, s } = ethers.utils.splitSignature(signature);

    const verifiedPassportTx =
      await this.gitcoinVerifier.addPassportWithSignature(
        GITCOIN_VC_SCHEMA,
        score,
        v,
        r,
        s
      );
    const verifiedPassport = await verifiedPassportTx.wait();
  });
});
