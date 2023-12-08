import { expect } from "chai";
import { ethers } from "hardhat";

describe("GitcoinIdentityStaking", function () {
  this.beforeEach(async function () {
    const [ownerAccount, ...userAccounts] = await ethers.getSigners();

    this.owner = ownerAccount;
    this.userAccounts = userAccounts;

    // Deploy GitcoinAttester
    const GitcoinIdentityStaking = await ethers.getContractFactory(
      "GitcoinIdentityStaking",
      this.owner
    );
    this.gitcoinIdentityStaking = await GitcoinIdentityStaking.deploy();
    await this.gitcoinIdentityStaking.connect(this.owner).initialize();
    //
    // Deploy GitcoinAttester
    const GitcoinIdentityStaking2 = await ethers.getContractFactory(
      "GitcoinIdentityStaking2",
      this.owner
    );
    this.gitcoinIdentityStaking2 = await GitcoinIdentityStaking2.deploy();
    await this.gitcoinIdentityStaking2.connect(this.owner).initialize();

    const GitcoinIdentityStaking3 = await ethers.getContractFactory(
      "GitcoinIdentityStaking3",
      this.owner
    );
    this.gitcoinIdentityStaking3 = await GitcoinIdentityStaking3.deploy();
    await this.gitcoinIdentityStaking3.connect(this.owner).initialize();
  });

  it.only("self stake gas tests", async function () {
    const userAccounts = this.userAccounts.slice(0, 1);

    await Promise.all(
      [
        this.gitcoinIdentityStaking
        // this.gitcoinIdentityStaking2,
        // this.gitcoinIdentityStaking3
      ].map(async (gitcoinIdentityStaking: any, idx: number) => {
        await Promise.all(
          userAccounts.map(async (userAccount: any, accountIdx: number) => {
            await gitcoinIdentityStaking
              .connect(userAccount)
              .selfStake(100000, 1702165387);

            await gitcoinIdentityStaking
              .connect(userAccount)
              .communityStake(
                this.userAccounts[accountIdx + 1],
                100000,
                1702165387
              );

            await gitcoinIdentityStaking
              .connect(userAccount)
              .communityStake(
                this.userAccounts[
                  accountIdx ? accountIdx - 1 : this.userAccounts.length - 1
                ],
                100000,
                1702165387
              );
          })
        );

        expect(await gitcoinIdentityStaking.stakeCount()).to.equal(
          userAccounts.length * 3
        );

        const addresses = userAccounts.map(
          ({ address }: { address: string }) => address
        );

        await gitcoinIdentityStaking
          .connect(this.owner)
          .slash(addresses, 50, 123);

        await gitcoinIdentityStaking
          .connect(this.owner)
          .slash(addresses, 50, 456);

        if (idx === 2) {
          await gitcoinIdentityStaking
            .connect(this.owner)
            .burn([...Array(userAccounts.length * 2).keys()].map((i) => i + 1));
        } else {
          await gitcoinIdentityStaking.connect(this.owner).burn();
        }
      })
    );
  });
});
