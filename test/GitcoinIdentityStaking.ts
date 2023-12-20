import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { keccak256 } from "ethers";

function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function makeSlashProof(slashMembers: any[][], slashNonce: string) {
  const slashProof = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      [
        {
          type: "tuple[]",
          name: "SlashMember",
          components: [
            {
              name: "account",
              type: "address",
              baseType: "address"
            },
            {
              name: "amount",
              type: "uint192",
              baseType: "uint192"
            }
          ]
        },
        "bytes32"
      ],
      [slashMembers, slashNonce]
    )
  );

  return slashProof;
}

describe("GitcoinIdentityStaking", function () {
  this.beforeEach(async function () {
    const [ownerAccount, ...userAccounts] = await ethers.getSigners();

    this.owner = ownerAccount;
    this.userAccounts = userAccounts;

    const GTC = await ethers.getContractFactory("GTC", this.owner);
    this.gtc = await GTC.deploy(
      this.owner.address,
      this.owner.address,
      Math.floor(new Date().getTime() / 1000) + 4
    );
    const gtcAddress = await this.gtc.getAddress();

    const GitcoinIdentityStaking = await ethers.getContractFactory(
      "GitcoinIdentityStaking",
      this.owner
    );
    this.gitcoinIdentityStaking = await GitcoinIdentityStaking.deploy();
    await this.gitcoinIdentityStaking
      .connect(this.owner)
      .initialize(gtcAddress, "0x0000000000000000000000000000000000000001");

    for (let i = 0; i < this.userAccounts.length; i++) {
      await this.gtc
        .connect(this.owner)
        .mint(userAccounts[i].address, 100000000000);
    }
  });

  it("gas tests", async function () {
    // const numUsers = 200;
    const numUsers = 20;
    const userAccounts = this.userAccounts.slice(0, numUsers);

    await Promise.all(
      [this.gitcoinIdentityStaking].map(async (gitcoinIdentityStaking: any) => {
        gitcoinIdentityStaking.grantRole(
          await gitcoinIdentityStaking.SLASHER_ROLE(),
          this.owner.address
        );
        gitcoinIdentityStaking.grantRole(
          await gitcoinIdentityStaking.RELEASER_ROLE(),
          this.owner.address
        );

        const unlockTime = Math.floor(new Date().getTime() / 1000) + 1000;

        await Promise.all(
          userAccounts.map(async (userAccount: any, accountIdx: number) => {
            // This changes the order of the transactions
            // which can affect gas. Randomizing to get an
            // average gas cost.
            for (const func of shuffleArray([
              () =>
                gitcoinIdentityStaking
                  .connect(userAccount)
                  .selfStake(100000, unlockTime),

              () =>
                gitcoinIdentityStaking
                  .connect(userAccount)
                  .communityStake(
                    this.userAccounts[accountIdx + 1],
                    100000,
                    unlockTime + 1000
                  ),

              () =>
                gitcoinIdentityStaking
                  .connect(userAccount)
                  .communityStake(
                    this.userAccounts[
                      accountIdx ? accountIdx - 1 : this.userAccounts.length - 1
                    ],
                    100000,
                    unlockTime + 2000
                  )
            ])) {
              await func();
            }
          })
        );

        const stakeIds: number[] = [];
        let slashMembers: any[][] = [];

        await Promise.all(
          userAccounts
            .slice(0, Math.floor((numUsers * 3) / 10))
            .map(async (userAccount: any) => {
              const stakeId = await gitcoinIdentityStaking.selfStakeIds(
                userAccount.address,
                0
              );
              const amount = (await gitcoinIdentityStaking.stakes(stakeId))[0];
              slashMembers.push([userAccount.address, amount]);
              stakeIds.push(stakeId);
            })
        );
        slashMembers = slashMembers.sort((a, b) => (a[0] < b[0] ? -1 : 1));

        const slashNonce = keccak256(Buffer.from(Math.random().toString()));

        const slashProof = makeSlashProof(slashMembers, slashNonce);

        await gitcoinIdentityStaking
          .connect(this.owner)
          .slash(stakeIds, 50, slashProof);

        await gitcoinIdentityStaking
          .connect(this.owner)
          .release(
            slashMembers,
            1,
            500,
            slashProof,
            slashNonce,
            ethers.keccak256(Buffer.from(Math.random().toString()))
          );

        await time.increase(60 * 60 * 24 * 91);

        await gitcoinIdentityStaking.connect(this.owner).burn();
      })
    );
  }).timeout(1000000);

  it("should reject burns too close together", async function () {
    await time.increase(60 * 60 * 24 * 91);
    await this.gitcoinIdentityStaking.connect(this.owner).burn();
    await expect(
      this.gitcoinIdentityStaking.connect(this.owner).burn()
    ).to.be.revertedWithCustomError(
      this.gitcoinIdentityStaking,
      "MinimumBurnRoundDurationNotMet"
    );
  });

  describe("failed stake tests", function () {
    it("should reject self stake with invalid unlock time", async function () {
      const unlockTime = Math.floor(new Date().getTime() / 1000) - 1000;

      await expect(
        this.gitcoinIdentityStaking
          .connect(this.userAccounts[0])
          .selfStake(100000, unlockTime)
      ).to.be.revertedWithCustomError(
        this.gitcoinIdentityStaking,
        "UnlockTimeMustBeInTheFuture"
      );
    });

    it("should reject community stake with invalid unlock time", async function () {
      const unlockTime = Math.floor(new Date().getTime() / 1000) - 1000;

      await expect(
        this.gitcoinIdentityStaking
          .connect(this.userAccounts[0])
          .communityStake(this.userAccounts[1], 100000, unlockTime)
      ).to.be.revertedWithCustomError(
        this.gitcoinIdentityStaking,
        "UnlockTimeMustBeInTheFuture"
      );
    });

    it("should reject self stake with amount 0", async function () {
      const unlockTime = Math.floor(new Date().getTime() / 1000) + 1000000000;

      await expect(
        this.gitcoinIdentityStaking
          .connect(this.userAccounts[0])
          .selfStake(0, unlockTime)
      ).to.be.revertedWithCustomError(
        this.gitcoinIdentityStaking,
        "AmountMustBeGreaterThanZero"
      );
    });

    it("should reject community stake with amount 0", async function () {
      const unlockTime = Math.floor(new Date().getTime() / 1000) + 1000000000;

      await expect(
        this.gitcoinIdentityStaking
          .connect(this.userAccounts[0])
          .communityStake(this.userAccounts[1], 0, unlockTime)
      ).to.be.revertedWithCustomError(
        this.gitcoinIdentityStaking,
        "AmountMustBeGreaterThanZero"
      );
    });

    it("should reject community stake on self", async function () {
      const unlockTime = Math.floor(new Date().getTime() / 1000) + 1000000000;

      await expect(
        this.gitcoinIdentityStaking
          .connect(this.userAccounts[0])
          .communityStake(this.userAccounts[0], 100000, unlockTime)
      ).to.be.revertedWithCustomError(
        this.gitcoinIdentityStaking,
        "CannotStakeOnSelf"
      );
    });
  });

  describe("standard tests", function () {
    beforeEach(async function () {
      const userAccounts = this.userAccounts.slice(0, 5);
      this.gitcoinIdentityStaking.grantRole(
        await this.gitcoinIdentityStaking.SLASHER_ROLE(),
        this.owner.address
      );
      this.gitcoinIdentityStaking.grantRole(
        await this.gitcoinIdentityStaking.RELEASER_ROLE(),
        this.owner.address
      );

      this.unlockDelay = 100000000;

      await Promise.all(
        userAccounts.map(async (userAccount: any, accountIdx: number) => {
          const unlockTime =
            Math.floor(new Date().getTime() / 1000) + this.unlockDelay;

          await this.gitcoinIdentityStaking
            .connect(userAccount)
            .selfStake(100000, unlockTime);
          await this.gitcoinIdentityStaking
            .connect(userAccount)
            .communityStake(
              this.userAccounts[accountIdx + 1],
              100000,
              unlockTime + 1000
            );
        })
      );
    });

    it("should slash stakes", async function () {
      const stakeIds = [1, 2, 3];

      const startingStakeAmount = (
        await this.gitcoinIdentityStaking.stakes(stakeIds[0])
      )[0];

      await this.gitcoinIdentityStaking
        .connect(this.owner)
        .slash(stakeIds, 50, ethers.keccak256(Buffer.from("notARealProof")));

      const afterSlashStakeAmount = (
        await this.gitcoinIdentityStaking.stakes(stakeIds[0])
      )[0];

      expect(afterSlashStakeAmount).to.equal(startingStakeAmount / BigInt(2));
      expect(afterSlashStakeAmount).to.equal(BigInt(50000));

      await this.gitcoinIdentityStaking
        .connect(this.owner)
        .slash(stakeIds, 80, ethers.keccak256(Buffer.from("anotherFakeProof")));

      const afterDoubleSlashStakeAmount = (
        await this.gitcoinIdentityStaking.stakes(stakeIds[0])
      )[0];

      expect(afterDoubleSlashStakeAmount).to.equal(
        startingStakeAmount / BigInt(2) / BigInt(5)
      );
      expect(afterDoubleSlashStakeAmount).to.equal(BigInt(10000));
    });

    it("should reject slash with already used proof", async function () {
      const stakeIds = [1, 2, 3];

      const proof = ethers.keccak256(Buffer.from("notARealProof"));

      await this.gitcoinIdentityStaking
        .connect(this.owner)
        .slash(stakeIds, 50, proof);

      await expect(
        this.gitcoinIdentityStaking
          .connect(this.owner)
          .slash(stakeIds, 50, proof)
      ).to.be.revertedWithCustomError(
        this.gitcoinIdentityStaking,
        "SlashProofHashAlreadyUsed"
      );
    });

    describe("with valid slashMembers", function () {
      beforeEach(async function () {
        const stakeIds: number[] = [];
        let slashMembers: any[][] = [];

        await Promise.all(
          this.userAccounts
            .slice(0, 3)
            .map(async (userAccount: any, index: number) => {
              const selfStakeId =
                await this.gitcoinIdentityStaking.selfStakeIds(
                  userAccount.address,
                  0
                );
              const selfStakeAmount = (
                await this.gitcoinIdentityStaking.stakes(selfStakeId)
              )[0];

              slashMembers.push([userAccount.address, selfStakeAmount]);
              stakeIds.push(selfStakeId);

              const communityStakeId =
                await this.gitcoinIdentityStaking.communityStakeIds(
                  userAccount.address,
                  this.userAccounts[index + 1].address,
                  0
                );

              const communityStakeAmount = (
                await this.gitcoinIdentityStaking.stakes(communityStakeId)
              )[0];

              slashMembers.push([
                this.userAccounts[index + 1].address,
                communityStakeAmount
              ]);
              stakeIds.push(communityStakeId);
            })
        );

        slashMembers = slashMembers.sort((a, b) => (a[0] < b[0] ? -1 : 1));

        this.slashMembers = slashMembers;
        this.stakeIds = stakeIds;
        this.slashNonce = keccak256(Buffer.from(Math.random().toString()));
        this.slashProof = makeSlashProof(this.slashMembers, this.slashNonce);
      });

      it("should release given a valid proof", async function () {
        await this.gitcoinIdentityStaking
          .connect(this.owner)
          .slash(this.stakeIds, 50, this.slashProof);

        const indexToRelease = 1;

        const newNonce = keccak256(Buffer.from(Math.random().toString()));

        await this.gitcoinIdentityStaking
          .connect(this.owner)
          .release(
            this.slashMembers,
            indexToRelease,
            500,
            this.slashProof,
            this.slashNonce,
            newNonce
          );

        this.slashMembers[indexToRelease][1] -= BigInt(500);

        const newSlashProof = makeSlashProof(this.slashMembers, newNonce);

        await this.gitcoinIdentityStaking
          .connect(this.owner)
          .release(
            this.slashMembers,
            2,
            1000,
            newSlashProof,
            newNonce,
            keccak256(Buffer.from(Math.random().toString()))
          );
      });

      it("should reject release with an invalid proof", async function () {
        await this.gitcoinIdentityStaking
          .connect(this.owner)
          .slash(this.stakeIds, 50, this.slashProof);

        [this.slashMembers[0], this.slashMembers[1]] = [
          this.slashMembers[1],
          this.slashMembers[0]
        ];

        await expect(
          this.gitcoinIdentityStaking
            .connect(this.owner)
            .release(
              this.slashMembers,
              1,
              500,
              this.slashProof,
              this.slashNonce,
              keccak256(Buffer.from(Math.random().toString()))
            )
        ).to.be.revertedWithCustomError(
          this.gitcoinIdentityStaking,
          "SlashProofHashNotValid"
        );
      });

      it("should reject release for too high of an amount", async function () {
        await this.gitcoinIdentityStaking
          .connect(this.owner)
          .slash(this.stakeIds, 50, this.slashProof);

        const indexToRelease = 1;

        await expect(
          this.gitcoinIdentityStaking
            .connect(this.owner)
            .release(
              this.slashMembers,
              indexToRelease,
              this.slashMembers[indexToRelease][1] + BigInt(1),
              this.slashProof,
              this.slashNonce,
              keccak256(Buffer.from(Math.random().toString()))
            )
        ).to.be.revertedWithCustomError(
          this.gitcoinIdentityStaking,
          "FundsNotAvailableToRelease"
        );
      });
    });

    it("should reject release with an unregistered proof", async function () {
      const slashNonce = keccak256(Buffer.from(Math.random().toString()));
      const slashProof = keccak256(Buffer.from("notARealProof"));

      await expect(
        this.gitcoinIdentityStaking
          .connect(this.owner)
          .release(
            [],
            1,
            500,
            slashProof,
            slashNonce,
            ethers.keccak256(Buffer.from(Math.random().toString()))
          )
      ).to.be.revertedWithCustomError(
        this.gitcoinIdentityStaking,
        "SlashProofHashNotFound"
      );
    });
  });
});
