import { ethers } from "hardhat";
import { expect } from "chai";
import {
  NO_EXPIRATION,
  ZERO_BYTES32,
} from "@ethereum-attestation-service/eas-sdk";
import { easEncodeScore, easEncodeStamp } from "./GitcoinAttester";

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

// SEPOLIA SPECIFIC
const EAS_CONTRACT_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
const GITCOIN_STAMP_SCHEMA =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";
const GITCOIN_SCORE_SCHEMA =
  "0x0f2928937d46e9ec78b350750185d2f495e708f79b383cef23b903fe120d9a2e";

const fee1 = utils.parseEther("0.001").toHexString();
const fee1Less1Wei = utils.parseEther("0.000999999999999999").toHexString();
const fee2 = utils.parseEther("0.002").toHexString();

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
    { name: "recipient", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "fee", type: "uint256" },
  ],
};

const scorer1Score = {
  score: 100,
  scorer_id: 420,
};

const scorer2Score = {
  score: 200,
  scorer_id: 240,
};

function sumDataLengths(requests: { data: any[] }[]): number {
  return requests.reduce((total, request) => total + request.data.length, 0);
}

describe("GitcoinVerifier", function () {
  this.beforeAll(async function () {
    const [owner, iamAccount, recipientAccount] = await ethers.getSigners();
    this.owner = owner;
    this.iamAccount = iamAccount;
    this.owner = owner;
    this.recipientAccount = recipientAccount;

    // Deploy GitcoinAttester
    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
    this.gitcoinAttester = await GitcoinAttester.deploy();
    await this.gitcoinAttester.setEASAddress(EAS_CONTRACT_ADDRESS);

    // Deploy GitcoinVerifier
    const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
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
      name: "GitcoinVerifier",
      version: "1",
      chainId,
      verifyingContract: this.gitcoinVerifier.address,
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
              recipient: this.recipientAccount.address,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeStamp(googleStamp),
              value: 0,
            },
            {
              recipient: this.recipientAccount.address,
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
              recipient: this.recipientAccount.address,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer1Score),
              value: 0,
            },
            {
              recipient: this.recipientAccount.address,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer2Score),
              value: 0,
            },
            {
              recipient: this.recipientAccount.address,
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer2Score),
              value: 0,
            },
          ],
        },
      ],
      recipient: this.recipientAccount.address,
      nonce: await this.getNonce(this.recipientAccount.address),
      fee: fee1,
    };

    this.getOtherPassport = async () => {
      return {
        multiAttestationRequest: [
          {
            schema: GITCOIN_STAMP_SCHEMA,
            data: [
              {
                recipient: this.recipientAccount.address,
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
                recipient: this.recipientAccount.address,
                expirationTime: NO_EXPIRATION,
                revocable: true,
                refUID: ZERO_BYTES32,
                data: easEncodeScore(scorer1Score),
                value: 0,
              },
            ],
          },
        ],
        recipient: this.recipientAccount.address,
        nonce: await this.getNonce(this.recipientAccount.address),
        fee: fee1,
      };
    };
  });

  this.beforeEach(async function () {
    this.passport.nonce = await this.gitcoinVerifier.recipientNonces(
      this.passport.recipient
    );
  });

  it("should verify signature and make attestations for each stamp", async function () {
    const signature = await this.iamAccount._signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );

    const recoveredAddress = ethers.utils.verifyTypedData(
      this.domain,
      passportTypes,
      this.passport,
      signature
    );

    expect(recoveredAddress).to.equal(this.iamAccount.address);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    const verifiedPassport = await (
      await this.gitcoinVerifier.addPassportWithSignature(
        this.passport,
        v,
        r,
        s,
        {
          value: fee1,
        }
      )
    ).wait();

    expect(verifiedPassport.events?.length).to.equal(
      sumDataLengths(this.passport.multiAttestationRequest)
    );
  });

  it("should revert if the signature is invalid", async function () {
    const signature = await this.iamAccount._signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );

    const recoveredAddress = ethers.utils.verifyTypedData(
      this.domain,
      passportTypes,
      this.passport,
      signature
    );

    expect(recoveredAddress).to.equal(this.iamAccount.address);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    const otherPassport = await this.getOtherPassport();
    await expect(
      this.gitcoinVerifier.addPassportWithSignature(otherPassport, v, r, s, {
        value: fee1,
      })
    ).to.be.revertedWith("Invalid signature");
  });

  it("should revert if addPassportWithSignature is called twice with the same parameters", async function () {
    const signature = await this.iamAccount._signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );
    const { v, r, s } = ethers.utils.splitSignature(signature);

    // calling addPassportWithSignature 1st time
    const result = await (
      await this.gitcoinVerifier.addPassportWithSignature(
        this.passport,
        v,
        r,
        s,
        {
          value: fee1,
        }
      )
    ).wait();

    expect(result.events?.length).to.equal(
      sumDataLengths(this.passport.multiAttestationRequest)
    );

    await expect(
      this.gitcoinVerifier.addPassportWithSignature(this.passport, v, r, s, {
        value: fee1,
      })
    ).to.be.revertedWith("Invalid nonce");
  });

  it("should revert if fee is insufficient", async function () {
    const signature = await this.iamAccount._signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );
    const recoveredAddress = ethers.utils.verifyTypedData(
      this.domain,
      passportTypes,
      this.passport,
      signature
    );

    expect(recoveredAddress).to.equal(this.iamAccount.address);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    await expect(
      this.gitcoinVerifier.addPassportWithSignature(this.passport, v, r, s, {
        value: fee1Less1Wei,
      })
    ).to.be.revertedWith("Insufficient fee");
  });

  it("should accept fee", async function () {
    const signature = await this.iamAccount._signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );
    const recoveredAddress = ethers.utils.verifyTypedData(
      this.domain,
      passportTypes,
      this.passport,
      signature
    );

    expect(recoveredAddress).to.equal(this.iamAccount.address);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    const verifiedPassport =
      await this.gitcoinVerifier.addPassportWithSignature(
        this.passport,
        v,
        r,
        s,
        {
          value: fee2,
        }
      );
    const receipt = await verifiedPassport.wait();
    expect(receipt.status).to.equal(1);
  });

  describe("withdrawFees", function () {
    this.beforeEach(async function () {
      const signature = await this.iamAccount._signTypedData(
        this.domain,
        passportTypes,
        this.passport
      );

      const { v, r, s } = ethers.utils.splitSignature(signature);
      await (
        await this.gitcoinVerifier.addPassportWithSignature(
          this.passport,
          v,
          r,
          s,
          {
            value: fee2,
          }
        )
      ).wait();
    });
    it("should allow the owner to withdraw all fees", async function () {
      const balanceBefore = await this.owner.getBalance();
      const verifierBalance = await ethers.provider.getBalance(
        this.gitcoinVerifier.address
      );

      const tx = await this.gitcoinVerifier.withdrawFees();
      await tx.wait();

      const ownerBalanceAfter = await this.owner.getBalance();

      const contractBalanceAfter = await ethers.provider.getBalance(
        this.gitcoinVerifier.address
      );

      expect(ownerBalanceAfter.gt(balanceBefore)).to.be.true;
      expect(contractBalanceAfter.eq(0)).to.be.true;
    });

    it("should reduce the contract balance after withdrawal", async function () {
      const [owner] = await ethers.getSigners();
      const contractBalanceBefore = await ethers.provider.getBalance(
        this.gitcoinVerifier.address
      );

      await this.gitcoinVerifier.withdrawFees();

      const contractBalanceAfter = await ethers.provider.getBalance(
        this.gitcoinVerifier.address
      );

      expect(contractBalanceAfter.lt(contractBalanceBefore)).to.be.true;
      expect(contractBalanceAfter.eq(0)).to.be.true;
    });

    it("should not allow non-owners to withdraw fees", async function () {
      const [, nonOwner] = await ethers.getSigners();

      await expect(
        this.gitcoinVerifier.connect(nonOwner).withdrawFees()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Ownership", function () {
    it("should not allow non owners to transfer ownership", async function () {
      const [, nonOwner] = await ethers.getSigners();

      await expect(
        this.gitcoinVerifier
          .connect(nonOwner)
          .transferOwnership(nonOwner.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow owner to transfer ownership", async function () {
      await this.gitcoinVerifier.transferOwnership(this.iamAccount.address);
      expect(await this.gitcoinVerifier.owner()).to.equal(
        this.iamAccount.address
      );
    });
  });
});
