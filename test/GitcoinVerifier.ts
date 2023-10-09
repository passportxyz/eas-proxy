import { ethers } from "hardhat";
import { expect } from "chai";
import {
  NO_EXPIRATION,
  ZERO_BYTES32,
} from "@ethereum-attestation-service/eas-sdk";
import { easEncodeScore, easEncodeStamp } from "./helpers/mockAttestations";

export const googleStamp = {
  provider: "Google",
  stampHash: "234567890",
};

export const facebookStamp = {
  provider: "Facebook",
  stampHash: "234567891",
};

export const twitterStamp = {
  provider: "Twitter",
  stampHash: "234567891",
};

// SEPOLIA SPECIFIC
export const EAS_CONTRACT_ADDRESS =
  "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
export const GITCOIN_STAMP_SCHEMA =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";
export const GITCOIN_SCORE_SCHEMA =
  "0x0f2928937d46e9ec78b350750185d2f495e708f79b383cef23b903fe120d9a2e";

export const fee1 = ethers.parseEther("0.001");
export const fee1Less1Wei = ethers.parseEther("0.000999999999999999");
export const fee2 = ethers.parseEther("0.002");

export const passportTypes = {
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

export const scorer1Score = {
  score: 100,
  scorer_id: 420,
};

export const scorer2Score = {
  score: 200,
  scorer_id: 240,
};

export function sumDataLengths(requests: { data: any[] }[]): number {
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
    await this.gitcoinAttester.connect(this.owner).initialize();
    await this.gitcoinAttester.setEASAddress(EAS_CONTRACT_ADDRESS);

    // Deploy GitcoinVerifier
    const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
    this.gitcoinVerifier = await GitcoinVerifier.deploy();

    await this.gitcoinVerifier
      .connect(this.owner)
      .initialize(
        await this.iamAccount.getAddress(),
        await this.gitcoinAttester.getAddress()
      );

    // Add verifier to GitcoinAttester allow-list
    const tx = await this.gitcoinAttester.addVerifier(
      await this.gitcoinVerifier.getAddress()
    );
    await tx.wait();

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
              recipient: await this.recipientAccount.getAddress(),
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeStamp(googleStamp),
              value: 0,
            },
            {
              recipient: await this.recipientAccount.getAddress(),
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
              recipient: await this.recipientAccount.getAddress(),
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer1Score),
              value: 0,
            },
            {
              recipient: await this.recipientAccount.getAddress(),
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer2Score),
              value: 0,
            },
            {
              recipient: await this.recipientAccount.getAddress(),
              expirationTime: NO_EXPIRATION,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer2Score),
              value: 0,
            },
          ],
        },
      ],
      nonce: await this.getNonce(await this.recipientAccount.getAddress()),
      fee: fee1,
    };

    this.getOtherPassport = async () => {
      return {
        multiAttestationRequest: [
          {
            schema: GITCOIN_STAMP_SCHEMA,
            data: [
              {
                recipient: await this.recipientAccount.getAddress(),
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
                recipient: await this.recipientAccount.getAddress(),
                expirationTime: NO_EXPIRATION,
                revocable: true,
                refUID: ZERO_BYTES32,
                data: easEncodeScore(scorer1Score),
                value: 0,
              },
            ],
          },
        ],
        nonce: await this.getNonce(await this.recipientAccount.getAddress()),
        fee: fee1,
      };
    };
  });

  this.beforeEach(async function () {
    this.passport.nonce = await this.gitcoinVerifier.recipientNonces(
      this.passport.multiAttestationRequest[0].data[0].recipient
    );
  });

  it("should verify signature and make attestations for each stamp", async function () {
    const signature = await this.iamAccount.signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );

    const recoveredAddress = ethers.verifyTypedData(
      this.domain,
      passportTypes,
      this.passport,
      signature
    );

    expect(recoveredAddress).to.equal(await this.iamAccount.getAddress());
    const { v, r, s } = ethers.Signature.from(signature);

    const verifiedPassport = await (
      await this.gitcoinVerifier.verifyAndAttest(this.passport, v, r, s, {
        value: fee1,
      })
    ).wait();

    expect(verifiedPassport.logs?.length).to.equal(
      sumDataLengths(this.passport.multiAttestationRequest)
    );
  });

  it("should revert if the signature is invalid", async function () {
    const signature = await this.iamAccount.signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );

    const recoveredAddress = ethers.verifyTypedData(
      this.domain,
      passportTypes,
      this.passport,
      signature
    );

    expect(recoveredAddress).to.equal(await this.iamAccount.getAddress());

    const { v, r, s } = ethers.Signature.from(signature);

    const otherPassport = await this.getOtherPassport();
    await expect(
      this.gitcoinVerifier.verifyAndAttest(otherPassport, v, r, s, {
        value: fee1,
      })
    ).to.be.revertedWith("Invalid signature");
  });

  it("should revert if verifyAndAttest is called twice with the same parameters", async function () {
    const signature = await this.iamAccount.signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );
    const { v, r, s } = ethers.Signature.from(signature);

    // calling verifyAndAttest 1st time
    const result = await (
      await this.gitcoinVerifier.verifyAndAttest(this.passport, v, r, s, {
        value: fee1,
      })
    ).wait();

    expect(result.logs?.length).to.equal(
      sumDataLengths(this.passport.multiAttestationRequest)
    );

    await expect(
      this.gitcoinVerifier.verifyAndAttest(this.passport, v, r, s, {
        value: fee1,
      })
    ).to.be.revertedWith("Invalid nonce");
  });

  it("should revert if fee is insufficient", async function () {
    const signature = await this.iamAccount.signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );
    const recoveredAddress = ethers.verifyTypedData(
      this.domain,
      passportTypes,
      this.passport,
      signature
    );

    expect(recoveredAddress).to.equal(await this.iamAccount.getAddress());

    const { v, r, s } = ethers.Signature.from(signature);

    await expect(
      this.gitcoinVerifier.verifyAndAttest(this.passport, v, r, s, {
        value: fee1Less1Wei,
      })
    ).to.be.revertedWith("Insufficient fee");
  });

  it("should accept fee", async function () {
    const signature = await this.iamAccount.signTypedData(
      this.domain,
      passportTypes,
      this.passport
    );
    const recoveredAddress = ethers.verifyTypedData(
      this.domain,
      passportTypes,
      this.passport,
      signature
    );

    expect(recoveredAddress).to.equal(await this.iamAccount.getAddress());

    const { v, r, s } = ethers.Signature.from(signature);

    const verifiedPassport = await this.gitcoinVerifier.verifyAndAttest(
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
      const signature = await this.iamAccount.signTypedData(
        this.domain,
        passportTypes,
        this.passport
      );

      const { v, r, s } = ethers.Signature.from(signature);
      await (
        await this.gitcoinVerifier.verifyAndAttest(this.passport, v, r, s, {
          value: fee2,
        })
      ).wait();
    });
    it("should allow the owner to withdraw a specified amount fee amount", async function () {
      const balanceBefore = await ethers.provider.getBalance(
        await this.owner.getAddress()
      );
      const verifierBalance = await ethers.provider.getBalance(
        await this.gitcoinVerifier.getAddress()
      );

      const withdrawAmount = ethers.parseUnits("0.0005", 18);

      const tx = await this.gitcoinVerifier.withdrawFees(withdrawAmount);
      await tx.wait();

      const ownerBalanceAfter = await ethers.provider.getBalance(
        await this.owner.getAddress()
      );
      
      const contractBalanceAfter = await ethers.provider.getBalance(
        await this.gitcoinVerifier.getAddress()
      );

      const contractBalance = verifierBalance - withdrawAmount;

      expect(ownerBalanceAfter > balanceBefore).to.be.true;
      expect(contractBalanceAfter === BigInt(contractBalance)).to.be.true;
    });

    it("should reduce the contract balance after withdrawal", async function () {
      const [owner] = await ethers.getSigners();
      const contractBalanceBefore = await ethers.provider.getBalance(
        await this.gitcoinVerifier.getAddress()
      );

      const withdrawAmount = ethers.parseUnits("0.0005", 18);

      await this.gitcoinVerifier.withdrawFees(withdrawAmount);

      const contractBalanceAfter = await ethers.provider.getBalance(
        await this.gitcoinVerifier.getAddress()
      );

      const contractBalance = contractBalanceBefore - withdrawAmount;

      expect(contractBalanceAfter < contractBalanceBefore).to.be.true;
      expect(contractBalanceAfter === BigInt(contractBalance)).to.be.true;
    });

    it("should not allow non-owners to withdraw fees", async function () {
      const [, nonOwner] = await ethers.getSigners();

      const withdrawAmount = ethers.parseUnits("0.0005", 18);

      await expect(
        this.gitcoinVerifier.connect(nonOwner).withdrawFees(withdrawAmount)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should revert if withdrawal amount is greater than the contract balance", async function () {
      const [owner] = await ethers.getSigners();

      const contractBalanceBefore = await ethers.provider.getBalance(
        await this.gitcoinVerifier.getAddress()
      );

      const withdrawAmount = ethers.parseUnits("0.07", 18);

      await expect(
        this.gitcoinVerifier.connect(owner).withdrawFees(withdrawAmount)
      ).to.be.revertedWith("Insufficient contract balance");
    });
  });

  describe("Ownership", function () {
    it("should not allow non owners to transfer ownership", async function () {
      const [, nonOwner] = await ethers.getSigners();

      await expect(
        this.gitcoinVerifier
          .connect(nonOwner)
          .transferOwnership(await nonOwner.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should allow owner to transfer ownership", async function () {
      await this.gitcoinVerifier.transferOwnership(
        await this.iamAccount.getAddress()
      );
      expect(await this.gitcoinVerifier.owner()).to.equal(
        await this.iamAccount.getAddress()
      );
      await this.gitcoinVerifier
        .connect(this.iamAccount)
        .transferOwnership(await this.owner.getAddress());
    });
  });
  describe("Pausability", function () {
    it("should pause and unpause", async function () {
      await this.gitcoinVerifier.connect(this.owner).pause();
      expect(await this.gitcoinVerifier.paused()).to.equal(true);
      await this.gitcoinVerifier.connect(this.owner).unpause();
      expect(await this.gitcoinVerifier.paused()).to.equal(false);
    });

    it("should revert when paused", async function () {
      await this.gitcoinVerifier.connect(this.owner).pause();
      await expect(
        this.gitcoinVerifier.verifyAndAttest(
          this.passport,
          8,
          "0x69bec0b6cd72c2116c44b777f6d3df6cd5e40b0aa2107e6c79108a414260e35b",
          "0x25fa382cd5b3d4577f4977fc3a0b742ee65ac8a3037789466f4ac3dfbb6eccc6",
          {
            value: fee2,
          }
        )
      ).to.be.revertedWith("Pausable: paused");
      await this.gitcoinVerifier.unpause();
    });
    it("should not allow non owner to pause", async function () {
      await this.gitcoinVerifier
        .connect(this.owner)
        .transferOwnership(await this.iamAccount.getAddress());
      await expect(
        this.gitcoinVerifier.connect(this.owner).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
