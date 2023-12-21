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

const fiveMinutes = 5 * 60;
const twelveWeeksInSeconds = 12 * 7 * 24 * 60 * 60 + 1; // 12 weeks in seconds

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
            },
            {
              type: "tuple[]",
              name: "stakes",
              components: [
                {
                  name: "staker",
                  type: "address",
                  baseType: "address"
                },
                {
                  name: "stakeId",
                  type: "uint256",
                  baseType: "uint256"
                }
              ]
            }
          ]
        },
        "uint256"
      ],
      [slashMembers, slashNonce]
    )
  );

  return slashProof;
}

async function makeSlashMembers(
  userAccounts: any,
  gitcoinIdentityStaking: any,
  numSlashMembers: number
) {
  let slashMembers: any[][] = [];

  await Promise.all(
    userAccounts
      .slice(0, numSlashMembers)
      .map(async (userAccount: any, index: number) => {
        const selfStakeId = await gitcoinIdentityStaking.selfStakeIds(
          userAccount.address,
          0
        );
        const selfStakeAmount = (
          await gitcoinIdentityStaking.stakes(selfStakeId)
        )[0];

        slashMembers.push([
          userAccount.address,
          selfStakeAmount / BigInt(2),
          [[userAccount.address, selfStakeId]]
        ]);

        const communityStakeId = await gitcoinIdentityStaking.communityStakeIds(
          userAccount.address,
          userAccounts[index + 1].address,
          0
        );

        const communityStakeAmount = (
          await gitcoinIdentityStaking.stakes(communityStakeId)
        )[0];

        slashMembers.push([
          userAccounts[index + 1].address,
          communityStakeAmount / BigInt(2),
          [[userAccount.address, communityStakeId]]
        ]);
      })
  );

  slashMembers = slashMembers.sort((a, b) => (a[0] < b[0] ? -1 : 1));

  return slashMembers;
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

  it.only("gas tests", async function () {
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

        await Promise.all(
          userAccounts.map(async (userAccount: any, accountIdx: number) => {
            // This changes the order of the transactions
            // which can affect gas. Randomizing to get an
            // average gas cost.
            for (const func of shuffleArray([
              () =>
                gitcoinIdentityStaking
                  .connect(userAccount)
                  .selfStake(100000, twelveWeeksInSeconds),

              () =>
                gitcoinIdentityStaking
                  .connect(userAccount)
                  .communityStake(
                    this.userAccounts[accountIdx + 1],
                    100000,
                    twelveWeeksInSeconds
                  ),

              () =>
                gitcoinIdentityStaking
                  .connect(userAccount)
                  .communityStake(
                    this.userAccounts[
                      accountIdx ? accountIdx - 1 : this.userAccounts.length - 1
                    ],
                    100000,
                    twelveWeeksInSeconds
                  )
            ])) {
              await func();
            }
          })
        );

        const slashMembers = await makeSlashMembers(
          userAccounts,
          gitcoinIdentityStaking,
          Math.floor((numUsers * 3) / 10)
        );

        const slashTx = await gitcoinIdentityStaking
          .connect(this.owner)
          .slash(slashMembers, 50);

        const slashReceipt = await slashTx.wait();

        const slashEvent = slashReceipt.logs[0];

        const slashProof = slashEvent.args[2];
        const slashNonce = slashEvent.args[3];

        await gitcoinIdentityStaking
          .connect(this.owner)
          .release(slashMembers, 1, 500, slashProof, slashNonce);

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
        "InvalidLockTime"
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
        "InvalidLockTime"
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

      await Promise.all(
        userAccounts.map(async (userAccount: any, accountIdx: number) => {
          await this.gitcoinIdentityStaking
            .connect(userAccount)
            .selfStake(100000, twelveWeeksInSeconds);
          await this.gitcoinIdentityStaking
            .connect(userAccount)
            .communityStake(
              this.userAccounts[accountIdx + 1],
              100000,
              twelveWeeksInSeconds
            );
        })
      );
    });

    it("should slash stakes", async function () {
      const selfStakeId = await this.gitcoinIdentityStaking.selfStakeIds(
        this.userAccounts[0].address,
        0
      );

      const communityStakeId =
        await this.gitcoinIdentityStaking.communityStakeIds(
          this.userAccounts[0].address,
          this.userAccounts[1].address,
          0
        );

      const slashMembers = [
        [
          this.userAccounts[0].address,
          50000,
          [[this.userAccounts[0].address, selfStakeId]]
        ],
        [
          this.userAccounts[1].address,
          50000,
          [[this.userAccounts[0].address, communityStakeId]]
        ]
      ];

      const startingStakeAmount = (
        await this.gitcoinIdentityStaking.stakes(selfStakeId)
      )[0];

      await this.gitcoinIdentityStaking
        .connect(this.owner)
        .slash(slashMembers, 50);

      const afterSlashStakeAmount = (
        await this.gitcoinIdentityStaking.stakes(selfStakeId)
      )[0];

      expect(afterSlashStakeAmount).to.equal(startingStakeAmount / BigInt(2));
      expect(afterSlashStakeAmount).to.equal(BigInt(50000));

      const nextSlashMembers = [
        [
          this.userAccounts[0].address,
          40000,
          [[this.userAccounts[0].address, selfStakeId]]
        ],
        [
          this.userAccounts[1].address,
          40000,
          [[this.userAccounts[0].address, communityStakeId]]
        ]
      ];

      await this.gitcoinIdentityStaking
        .connect(this.owner)
        .slash(nextSlashMembers, 80);

      const afterDoubleSlashStakeAmount = (
        await this.gitcoinIdentityStaking.stakes(selfStakeId)
      )[0];

      expect(afterDoubleSlashStakeAmount).to.equal(
        startingStakeAmount / BigInt(2) / BigInt(5)
      );
      expect(afterDoubleSlashStakeAmount).to.equal(BigInt(10000));
    });

    describe("with valid slashMembers", function () {
      beforeEach(async function () {
        this.slashMembers = await makeSlashMembers(
          this.userAccounts,
          this.gitcoinIdentityStaking,
          3
        );

        const slashTx = await this.gitcoinIdentityStaking
          .connect(this.owner)
          .slash(this.slashMembers, 50);

        const slashReceipt = await slashTx.wait();

        const slashEvent = slashReceipt.logs[0];

        this.slashProof = slashEvent.args[2];
        this.slashNonce = slashEvent.args[3];

        expect(this.slashProof).to.not.be.null;
        expect(this.slashNonce).to.not.be.null;

        console.log("Slash Proof: ", this.slashProof);
        console.log("Slash Nonce: ", this.slashNonce);
      });

      it("should release given a valid proof", async function () {
        const indexToRelease = 1;

        await this.gitcoinIdentityStaking
          .connect(this.owner)
          .release(
            this.slashMembers,
            indexToRelease,
            500,
            this.slashProof,
            this.slashNonce
          );

        this.slashMembers[indexToRelease][1] -= BigInt(500);

        const newSlashProof = makeSlashProof(
          this.slashMembers,
          this.slashNonce
        );

        await this.gitcoinIdentityStaking
          .connect(this.owner)
          .release(this.slashMembers, 2, 1000, newSlashProof, this.slashNonce);
      });

      it("should reject release with an invalid proof", async function () {
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
              this.slashNonce
            )
        ).to.be.revertedWithCustomError(
          this.gitcoinIdentityStaking,
          "SlashProofHashNotValid"
        );
      });

      it("should reject release for too high of an amount", async function () {
        const indexToRelease = 1;

        await expect(
          this.gitcoinIdentityStaking
            .connect(this.owner)
            .release(
              this.slashMembers,
              indexToRelease,
              this.slashMembers[indexToRelease][1] + BigInt(1),
              this.slashProof,
              this.slashNonce
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
          .release([], 1, 500, slashProof, slashNonce)
      ).to.be.revertedWithCustomError(
        this.gitcoinIdentityStaking,
        "SlashProofHashNotFound"
      );
    });
  });

  describe.skip("Self and Community Staking", function () {
    it("should allow self staking", async function () {
      const fiveMinutes = 5 * 60; // 5 minutes in seconds
      const unlockTime =
        twelveWeeksInSeconds + Math.floor(new Date().getTime() / 1000);
      await this.gitcoinIdentityStaking
        .connect(this.userAccounts[0])
        .selfStake(100000n, twelveWeeksInSeconds);

      const userStake = await this.gitcoinIdentityStaking.selfStakeIds(
        this.userAccounts[0],
        0
      );

      const stake = await this.gitcoinIdentityStaking.stakes(userStake);

      expect(stake[0]).to.deep.equal(100000n);
      expect(stake[1]).to.be.closeTo(unlockTime, fiveMinutes);
    });
    it("should allow withdrawal of self stake", async function () {
      await this.gitcoinIdentityStaking
        .connect(this.userAccounts[0])
        .selfStake(100000n, twelveWeeksInSeconds);
      await time.increaseTo(
        twelveWeeksInSeconds + Math.floor(new Date().getTime() / 1000)
      );

      await this.gitcoinIdentityStaking
        .connect(this.userAccounts[0])
        .withdrawSelfStake(1);
    });
    it("should allow community staking", async function () {
      const unlockTime =
        twelveWeeksInSeconds + Math.floor(new Date().getTime() / 1000);
      await this.gitcoinIdentityStaking
        .connect(this.userAccounts[0])
        .communityStake(this.userAccounts[1], 100000n, twelveWeeksInSeconds);
      const communityStake =
        await this.gitcoinIdentityStaking.communityStakeIds(
          this.userAccounts[0],
          this.userAccounts[1],
          0
        );

      const stake = await this.gitcoinIdentityStaking.stakes(communityStake);

      expect(stake[0]).to.deep.equal(100000n);
      expect(stake[1]).to.be.closeTo(unlockTime, fiveMinutes);
    });
    it("should allow withdrawal of self stake", async function () {
      await this.gitcoinIdentityStaking
        .connect(this.userAccounts[0])
        .selfStake(100000n, twelveWeeksInSeconds);
      await time.increaseTo(
        twelveWeeksInSeconds + Math.floor(new Date().getTime() / 1000)
      );

      await this.gitcoinIdentityStaking
        .connect(this.userAccounts[0])
        .withdrawSelfStake(1);
    });
  });
});
