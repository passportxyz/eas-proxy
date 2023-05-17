import { ethers } from "hardhat";
import { expect } from "chai";
import { NO_EXPIRATION, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";
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

const EAS_CONTRACT_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
const GITCOIN_VC_SCHEMA =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";

describe("GitcoinVerifier", function () {
  this.beforeAll(async function () {
    const [owner, iamAccount, recipientAccount] = await ethers.getSigners();
    this.iamAccount = iamAccount;
    this.recipientAccount = recipientAccount;

    // Deploy GitcoinAttester
    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
    this.gitcoinAttester = await GitcoinAttester.deploy();

    // Deploy GitcoinVerifier
    const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
    this.gitcoinVerifier = await GitcoinVerifier.deploy(
      this.iamAccount.address,
      this.gitcoinAttester.address
    );

    // Add verifier to GitcoinAttester allow-list
    const tx = await this.gitcoinAttester.addVerifier(this.gitcoinVerifier.address);
    await tx.wait();

    const chainId = await this.iamAccount.getChainId();
    console.log({ chainId });
    this.domain = {
      name: "GitcoinVerifier",
      version: "1",
      chainId,
      verifyingContract: this.gitcoinVerifier.address,
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
        { name: "nonce", type: "uint256" },
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
      recipient: this.recipientAccount.address,
      expirationTime: NO_EXPIRATION,
      revocable: true,
      refUID: ZERO_BYTES32,
      value: 0,
    };
  });

  this.beforeEach(async function () {
    this.passport.nonce = await this.gitcoinVerifier.recipientNonces(
      this.passport.recipient
    );
  });

  it("should verify signature and make attestations for each stamp", async function () {
    await this.gitcoinAttester.setEASAddress(EAS_CONTRACT_ADDRESS);
    const chainId = await this.iamAccount.getChainId();

    const domain = {
      name: "GitcoinVerifier",
      version: "1",
      chainId,
      verifyingContract: this.gitcoinVerifier.address,
    };

    const types = {
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
        { name: "nonce", type: "uint256" },
      ],
    };

    const passport = {
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
          encodedData: easEncodeData(facebookStamp),
        },
      ],
      recipient: this.recipientAccount.address,
      expirationTime: NO_EXPIRATION,
      revocable: true,
      refUID: ZERO_BYTES32,
      value: 0,
      nonce: 0,
    };

    const signature = await this.iamAccount._signTypedData(domain, types, passport);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    const verifiedPassportTx = await this.gitcoinVerifier.addPassportWithSignature(
      GITCOIN_VC_SCHEMA,
      passport,
      v,
      r,
      s
    );
    const verifiedPassport = await verifiedPassportTx.wait();
    expect(verifiedPassport.events?.length).to.equal(passport.stamps.length);
  });

  it("should revert if the signature is invalid", async function () {
    const signature = await this.iamAccount._signTypedData(
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

    expect(recoveredAddress).to.equal(this.iamAccount.address);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    this.passport.stamps[0].stampHash = "0x00000000";

    try {
      await this.gitcoinVerifier.addPassportWithSignature(
        GITCOIN_VC_SCHEMA,
        this.passport,
        v,
        r,
        s
      );
    } catch (e: any) {
      expect(e.message).to.include("Invalid signature");
      return;
    }
  });

  it("should revert if addPassportWithSignature is called twice with the same parameters", async function () {
    const signature = await this.iamAccount._signTypedData(
      this.domain,
      this.types,
      this.passport
    );

    const { v, r, s } = ethers.utils.splitSignature(signature);

    //calling addPassportWithSignature 1st time
    const result = await (
      await this.gitcoinVerifier.addPassportWithSignature(
        GITCOIN_VC_SCHEMA,
        this.passport,
        v,
        r,
        s
      )
    ).wait();

    expect(result.events?.length).to.equal(this.passport.stamps.length);

    //calling addPassportWithSignature 2nd time
    await expect(
      this.gitcoinVerifier.callStatic.addPassportWithSignature(
        GITCOIN_VC_SCHEMA,
        this.passport,
        v,
        r,
        s
      )
    ).to.be.revertedWith("Invalid signature");
  });
});
