import { expect } from "chai";
import { ethers } from "hardhat";

function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
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
      Math.floor(new Date().getTime() / 1000) + 2
    );
    const gtcAddress = await this.gtc.getAddress();

    const GitcoinIdentityStaking = await ethers.getContractFactory(
      "GitcoinIdentityStaking",
      this.owner
    );
    this.gitcoinIdentityStaking = await GitcoinIdentityStaking.deploy();
    await this.gitcoinIdentityStaking
      .connect(this.owner)
      .initialize(gtcAddress);

    // const GitcoinIdentityStaking2 = await ethers.getContractFactory(
    //   "GitcoinIdentityStaking2",
    //   this.owner
    // );
    // this.gitcoinIdentityStaking2 = await GitcoinIdentityStaking2.deploy();
    // await this.gitcoinIdentityStaking2
    //   .connect(this.owner)
    //   .initialize(gtcAddress);

    // const GitcoinIdentityStaking3 = await ethers.getContractFactory(
    //   "GitcoinIdentityStaking3",
    //   this.owner
    // );
    // this.gitcoinIdentityStaking3 = await GitcoinIdentityStaking3.deploy();
    // await this.gitcoinIdentityStaking3
    //   .connect(this.owner)
    //   .initialize(gtcAddress);

    // const GitcoinIdentityStaking4 = await ethers.getContractFactory(
    //   "GitcoinIdentityStaking4",
    //   this.owner
    // );
    // this.gitcoinIdentityStaking4 = await GitcoinIdentityStaking4.deploy();
    // await this.gitcoinIdentityStaking4
    //   .connect(this.owner)
    //   .initialize(gtcAddress);

    // const GitcoinIdentityStaking5 = await ethers.getContractFactory(
    //   "GitcoinIdentityStaking5",
    //   this.owner
    // );
    // this.gitcoinIdentityStaking5 = await GitcoinIdentityStaking5.deploy();
    // await this.gitcoinIdentityStaking5
    //   .connect(this.owner)
    //   .initialize(gtcAddress);

    // const GitcoinIdentityStaking6 = await ethers.getContractFactory(
    //   "GitcoinIdentityStaking6",
    //   this.owner
    // );
    // this.gitcoinIdentityStaking6 = await GitcoinIdentityStaking6.deploy();
    // await this.gitcoinIdentityStaking6
    //   .connect(this.owner)
    //   .initialize(gtcAddress);

    // const GitcoinIdentityStaking7 = await ethers.getContractFactory(
    //   "GitcoinIdentityStaking7",
    //   this.owner
    // );
    // this.gitcoinIdentityStaking7 = await GitcoinIdentityStaking7.deploy();
    // await this.gitcoinIdentityStaking7
    //   .connect(this.owner)
    //   .initialize(gtcAddress);

    // const GitcoinIdentityStaking8 = await ethers.getContractFactory(
    //   "GitcoinIdentityStaking8",
    //   this.owner
    // );
    // this.gitcoinIdentityStaking8 = await GitcoinIdentityStaking8.deploy();
    // await this.gitcoinIdentityStaking8
    //   .connect(this.owner)
    //   .initialize(gtcAddress);

    // const GitcoinIdentityStaking10 = await ethers.getContractFactory(
    //   "GitcoinIdentityStaking10",
    //   this.owner
    // );
    // this.gitcoinIdentityStaking10 = await GitcoinIdentityStaking10.deploy();
    // await this.gitcoinIdentityStaking10
    //   .connect(this.owner)
    //   .initialize(gtcAddress);

    // const GitcoinIdentityStaking11 = await ethers.getContractFactory(
    //   "GitcoinIdentityStaking11",
    //   this.owner
    // );
    // this.gitcoinIdentityStaking11 = await GitcoinIdentityStaking11.deploy();
    // await this.gitcoinIdentityStaking11
    //   .connect(this.owner)
    //   .initialize(gtcAddress);

    // const GitcoinIdentityStaking12 = await ethers.getContractFactory(
    //   "GitcoinIdentityStaking12",
    //   this.owner
    // );
    // this.gitcoinIdentityStaking12 = await GitcoinIdentityStaking12.deploy();
    // await this.gitcoinIdentityStaking12
    //   .connect(this.owner)
    //   .initialize(gtcAddress);

    // const GitcoinIdentityStaking13 = await ethers.getContractFactory(
    //   "GitcoinIdentityStaking13",
    //   this.owner
    // );
    // this.gitcoinIdentityStaking13 = await GitcoinIdentityStaking13.deploy();
    // await this.gitcoinIdentityStaking13
    //   .connect(this.owner)
    //   .initialize(gtcAddress);

    for (let i = 0; i < this.userAccounts.length; i++) {
      await this.gtc
        .connect(this.owner)
        .mint(userAccounts[i].address, 100000000000);
    }
  });

  it.only("self stake gas tests", async function () {
    const userAccounts = this.userAccounts.slice(0, 200);

    await Promise.all(
      [
        this.gitcoinIdentityStaking
        // this.gitcoinIdentityStaking2,
        // this.gitcoinIdentityStaking3,
        // this.gitcoinIdentityStaking4
        // this.gitcoinIdentityStaking5,
        // this.gitcoinIdentityStaking6,
        // this.gitcoinIdentityStaking7,
        // this.gitcoinIdentityStaking8
        // this.gitcoinIdentityStaking10,
        // this.gitcoinIdentityStaking11,
        // this.gitcoinIdentityStaking12
        // this.gitcoinIdentityStaking13
      ].map(async (gitcoinIdentityStaking: any) => {
        gitcoinIdentityStaking.grantRole(
          await gitcoinIdentityStaking.SLASHER_ROLE(),
          this.owner.address
        );
        gitcoinIdentityStaking.grantRole(
          await gitcoinIdentityStaking.BURNER_ROLE(),
          this.owner.address
        );
        gitcoinIdentityStaking.grantRole(
          await gitcoinIdentityStaking.RELEASER_ROLE(),
          this.owner.address
        );

        const slashAddresses: { staker: string; stakee: string }[] = [];

        await Promise.all(
          userAccounts.map(async (userAccount: any, accountIdx: number) => {
            for (const func of shuffleArray([
              () =>
                gitcoinIdentityStaking
                  .connect(userAccount)
                  .selfStake(100000, 1703165387),

              () =>
                gitcoinIdentityStaking
                  .connect(userAccount)
                  .communityStake(
                    this.userAccounts[accountIdx + 1],
                    100000,
                    1703165387
                  ),

              () =>
                gitcoinIdentityStaking
                  .connect(userAccount)
                  .communityStake(
                    this.userAccounts[
                      accountIdx ? accountIdx - 1 : this.userAccounts.length - 1
                    ],
                    100000,
                    1703165387
                  )
            ])) {
              await func();
            }
            slashAddresses.push(
              {
                staker: userAccount.address,
                stakee: userAccount.address
              },
              {
                staker: userAccount.address,
                stakee: this.userAccounts[accountIdx + 1].address
              },
              {
                staker: userAccount.address,
                stakee:
                  this.userAccounts[
                    accountIdx ? accountIdx - 1 : this.userAccounts.length - 1
                  ].address
              }
            );
          })
        );

        const stakeIds: number[] = [];
        let slashMembers: any[][] = [];

        await Promise.all(
          userAccounts.slice(0, 60).map(async (userAccount: any) => {
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
              }
            ],
            [slashMembers]
          )
        );

        await gitcoinIdentityStaking
          .connect(this.owner)
          .slash(stakeIds, 50, slashProof);

        const indexToRelease = 1;

        await gitcoinIdentityStaking
          .connect(this.owner)
          .release(slashMembers, indexToRelease, 500, slashProof);

        slashMembers[indexToRelease][1] -= BigInt(500);

        const newSlashProof = ethers.keccak256(
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
              }
            ],
            [slashMembers]
          )
        );

        await gitcoinIdentityStaking
          .connect(this.owner)
          .release(slashMembers, 2, 1000, newSlashProof);

        await gitcoinIdentityStaking.connect(this.owner).burn();
      })
    );
  }).timeout(1000000);
});
