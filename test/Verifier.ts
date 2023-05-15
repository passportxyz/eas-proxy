import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Signer } from "ethers";
import {
  NO_EXPIRATION,
  SchemaEncoder,
  ZERO_BYTES32,
} from "@ethereum-attestation-service/eas-sdk";
import { easEncodeData } from "./GitcoinAttester";

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

let iamAccount: SignerWithAddress, iamSigner: Signer;

type Stamp = {
  provider: string;
  stampHash: string;
  expirationDate: string;
};

const gitcoinVCSchema =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";

describe("Verifier", function () {
  this.beforeAll(async function () {
    const [owner, otherAccount] = await ethers.getSigners();

    // Mock deploy AggregatorV3Interface contract
    const MockAggregator = await ethers.getContractFactory(
      "MockAggregatorV3Interface"
    );
    this.priceFeed = await MockAggregator.deploy();
    await this.priceFeed.deployed();

    // Mock Deploy GitcoinAttester
    const gitcoinAttesterFactory = await ethers.getContractFactory(
      "GitcoinAttester"
    );
    this.gitcoinAttester = await gitcoinAttesterFactory.deploy();

    const verifierFactory = await ethers.getContractFactory("Verifier");
    iamAccount = owner;
    this.verifier = await verifierFactory.deploy(
      iamAccount.address,
      this.gitcoinAttester.address,
      this.priceFeed.address
    );
    this.otherAccount = otherAccount;
    const chainId = await iamAccount.getChainId();

    this.domain = {
      name: "Attester",
      version: "1",
      chainId,
      verifyingContract: this.verifier.address,
    };

    this.types = {
      Stamp: [
        { name: "provider", type: "string" },
        { name: "stampHash", type: "string" },
        { name: "expirationDate", type: "string" },
        { name: "encodedData", type: "bytes" },
      ],
      Passport: [
        { name: "stamps", type: "Stamp[]" },
        { name: "recipient", type: "address" },
        { name: "expirationTime", type: "uint64" },
        { name: "revocable", type: "bool" },
        { name: "refUID", type: "bytes32" },
        { name: "value", type: "uint256" },
      ],
    };

    this.passport = {
      stamps: [
        {
          provider: googleStamp.provider,
          stampHash: googleStamp.stampHash,
          expirationDate: googleStamp.expirationDate,
          encodedData: easEncodeData(googleStamp),
        },
        {
          provider: facebookStamp.provider,
          stampHash: facebookStamp.stampHash,
          expirationDate: facebookStamp.expirationDate,
          encodedData: easEncodeData(googleStamp),
        },
      ],
      recipient: this.otherAccount.address,
      expirationTime: NO_EXPIRATION,
      revocable: true,
      refUID: ZERO_BYTES32,
      value: 0,
    };
  });
  it("should verify a valid EIP712 signature", async function () {
    const signature = await iamAccount._signTypedData(
      this.domain,
      this.types,
      this.passport
    );
    const recoveredAddress = ethers.utils.verifyTypedData(
      this.domain,
      this.types,
      this.passport,
      signature
    );

    expect(recoveredAddress).to.equal(iamAccount.address);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    const verifiedSignature = await this.verifier.verify(
      v,
      r,
      s,
      this.passport
    );

    expect(verifiedSignature).to.equal(true);
  });
  it("should revert if the signature is invalid", async function () {
    const signature = await iamAccount._signTypedData(
      this.domain,
      this.types,
      this.passport
    );
    const recoveredAddress = ethers.utils.verifyTypedData(
      this.domain,
      this.types,
      this.passport,
      signature
    );

    expect(recoveredAddress).to.equal(iamAccount.address);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    const badV = 30;

    try {
      const verifiedSignature = await this.verifier.verify(
        badV,
        r,
        s,
        this.passport
      );
    } catch (e: any) {
      expect(e.message).to.include("ECDSA: invalid signature");
      return;
    }
  });
  describe("checkFee", function () {
    it("should return true when fee is greater than $2", async function () {
      // Set the price of ETH in the mock price feed
      await this.priceFeed.setLatestAnswer(2000 * 10 ** 8); // ETH price is $2000

      const feeInWei = ethers.utils.parseEther("0.002"); // $4
      expect(await this.verifier.checkFee(feeInWei)).to.be.true;
    });

    it("should return false when fee is less than $2", async function () {
      await this.priceFeed.setLatestAnswer(2000 * 10 ** 8); // ETH price is $2000

      const feeInWei = ethers.utils.parseEther("0.0005"); // $1
      expect(await this.verifier.checkFee(feeInWei)).to.be.false;
    });
  });
});
