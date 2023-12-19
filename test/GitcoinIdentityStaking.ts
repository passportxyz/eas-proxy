import { expect } from "chai";
import { ethers } from "hardhat";

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

    const GitcoinIdentityStaking2 = await ethers.getContractFactory(
      "GitcoinIdentityStaking2",
      this.owner
    );
    this.gitcoinIdentityStaking2 = await GitcoinIdentityStaking2.deploy();
    await this.gitcoinIdentityStaking2
      .connect(this.owner)
      .initialize(gtcAddress);

    const GitcoinIdentityStaking3 = await ethers.getContractFactory(
      "GitcoinIdentityStaking3",
      this.owner
    );
    this.gitcoinIdentityStaking3 = await GitcoinIdentityStaking3.deploy();
    await this.gitcoinIdentityStaking3
      .connect(this.owner)
      .initialize(gtcAddress);

    const GitcoinIdentityStaking4 = await ethers.getContractFactory(
      "GitcoinIdentityStaking4",
      this.owner
    );
    this.gitcoinIdentityStaking4 = await GitcoinIdentityStaking4.deploy();
    await this.gitcoinIdentityStaking4
      .connect(this.owner)
      .initialize(gtcAddress);

    const GitcoinIdentityStaking5 = await ethers.getContractFactory(
      "GitcoinIdentityStaking5",
      this.owner
    );
    this.gitcoinIdentityStaking5 = await GitcoinIdentityStaking5.deploy();
    await this.gitcoinIdentityStaking5
      .connect(this.owner)
      .initialize(gtcAddress);

    const GitcoinIdentityStaking6 = await ethers.getContractFactory(
      "GitcoinIdentityStaking6",
      this.owner
    );
    this.gitcoinIdentityStaking6 = await GitcoinIdentityStaking6.deploy();
    await this.gitcoinIdentityStaking6
      .connect(this.owner)
      .initialize(gtcAddress);

    const GitcoinIdentityStaking7 = await ethers.getContractFactory(
      "GitcoinIdentityStaking7",
      this.owner
    );
    this.gitcoinIdentityStaking7 = await GitcoinIdentityStaking7.deploy();
    await this.gitcoinIdentityStaking7
      .connect(this.owner)
      .initialize(gtcAddress);

    const GitcoinIdentityStaking8 = await ethers.getContractFactory(
      "GitcoinIdentityStaking8",
      this.owner
    );
    this.gitcoinIdentityStaking8 = await GitcoinIdentityStaking8.deploy();
    await this.gitcoinIdentityStaking8
      .connect(this.owner)
      .initialize(gtcAddress);

    const GitcoinIdentityStaking10 = await ethers.getContractFactory(
      "GitcoinIdentityStaking10",
      this.owner
    );
    this.gitcoinIdentityStaking10 = await GitcoinIdentityStaking10.deploy();
    await this.gitcoinIdentityStaking10
      .connect(this.owner)
      .initialize(gtcAddress);

    const GitcoinIdentityStaking11 = await ethers.getContractFactory(
      "GitcoinIdentityStaking11",
      this.owner
    );
    this.gitcoinIdentityStaking11 = await GitcoinIdentityStaking11.deploy();
    await this.gitcoinIdentityStaking11
      .connect(this.owner)
      .initialize(gtcAddress);

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
        this.gitcoinIdentityStaking,
        // this.gitcoinIdentityStaking2,
        // this.gitcoinIdentityStaking3,
        // this.gitcoinIdentityStaking4
        // this.gitcoinIdentityStaking5,
        this.gitcoinIdentityStaking6,
        this.gitcoinIdentityStaking7,
        // this.gitcoinIdentityStaking8
        this.gitcoinIdentityStaking10,
        this.gitcoinIdentityStaking11
      ].map(async (gitcoinIdentityStaking: any) => {
        const slashAddresses: { staker: string; stakee: string }[] = [];

        await Promise.all(
          userAccounts.map(async (userAccount: any, accountIdx: number) => {
            let hasTimelock = true;
            try {
              gitcoinIdentityStaking["selfStake(uint256)"];
              hasTimelock = false;
            } catch {}

            if (hasTimelock) {
              await gitcoinIdentityStaking
                .connect(userAccount)
                .selfStake(100000, 1703165387);

              await gitcoinIdentityStaking
                .connect(userAccount)
                .communityStake(
                  this.userAccounts[accountIdx + 1],
                  100000,
                  1703165387
                );

              await gitcoinIdentityStaking
                .connect(userAccount)
                .communityStake(
                  this.userAccounts[
                    accountIdx ? accountIdx - 1 : this.userAccounts.length - 1
                  ],
                  100000,
                  1703165387
                );
            } else {
              await gitcoinIdentityStaking
                .connect(userAccount)
                .selfStake(100000);

              await gitcoinIdentityStaking
                .connect(userAccount)
                .communityStake(this.userAccounts[accountIdx + 1], 100000);

              await gitcoinIdentityStaking
                .connect(userAccount)
                .communityStake(
                  this.userAccounts[
                    accountIdx ? accountIdx - 1 : this.userAccounts.length - 1
                  ],
                  100000
                );
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

        // expect(await gitcoinIdentityStaking.stakeCount()).to.equal(
        //   userAccounts.length * 3
        // );

        const addresses = userAccounts
          .slice(0, 20)
          .map(({ address }: { address: string }) => address);

        const stakeIds = Array.from({ length: 60 }, (_, i) => i);

        for (const slashMethod in [
          ["slash(uint256[],uint64)", [stakeIds, 50]],
          ["slash(uint256[],uint64, uint256)", [stakeIds, 50, 123]],
          ["slash(address[],uint64)", [addresses, 50]],
          ["slash(address[],uint64, uint256)", [addresses, 50, 123]]
        ]) {
          const [func, args] = slashMethod;
          try {
            gitcoinIdentityStaking[func];
          } catch {
            continue;
          }
          await gitcoinIdentityStaking.connect(this.owner)[func](...args);
        }

        let hasBurnArgs = false;
        try {
          gitcoinIdentityStaking["burn(uint256[])"];
          hasBurnArgs = true;
        } catch {}

        if (hasBurnArgs) {
          await gitcoinIdentityStaking.connect(this.owner).burn([0, 1]);
        } else {
          await gitcoinIdentityStaking.connect(this.owner).burn();
        }

        let hasSlashAddresses = false;
        try {
          gitcoinIdentityStaking.slashAddresses;
          hasSlashAddresses = true;
        } catch {}
        if (hasSlashAddresses) {
          await gitcoinIdentityStaking.connect(this.owner).slashAddresses(
            slashAddresses.slice(0, 60).map(({ staker }) => staker),
            slashAddresses.slice(0, 60).map(({ stakee }) => stakee),
            50
          );
        }
      })
    );
  }).timeout(1000000);
});
