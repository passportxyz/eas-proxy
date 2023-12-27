import { expect } from "chai";
import { ethers } from "hardhat";
import { time, reset } from "@nomicfoundation/hardhat-network-helpers";
import { keccak256 } from "ethers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import fs from "fs";
import { ZERO_ADDRESS } from "@ethereum-attestation-service/eas-sdk";

type StakeMember = {
  address: string;
  amount: string;
  stakeId: number;
};

const shouldSlash = (numUsers: number, i: number): boolean =>
  i < Math.floor((numUsers * 3) / 10);

const buildBadListMerkleTree = (
  users: StakeMember[],
  numUsers: number
): {
  merkleRoot: string;
  slashTotal: number;
  slashedUsers: string[];
} => {
  const slashedUsers: string[] = [];
  let slashTotal = 0;
  const values: [string, string][] = users
    .filter((user, i) => !shouldSlash(numUsers, i))
    .map((user) => [user.address, BigInt(user.address).toString()]);

  const merkleTree = StandardMerkleTree.of(values, ["address", "uint192"]);

  const merkleRoot = merkleTree.root;

  fs.writeFileSync("badList.json", JSON.stringify(merkleTree.dump()));

  return { merkleRoot, slashTotal, slashedUsers };
};

// https://github.com/OpenZeppelin/merkle-tree
const buildSlashMerkleTree = (
  users: StakeMember[],
  numUsers: number
): {
  merkleRoot: string;
  slashTotal: number;
  slashedUsers: string[];
} => {
  const slashedUsers: string[] = [];
  let slashTotal = 0;
  const values: [string, string, string][] = users.map((user, i) => {
    const slash = shouldSlash(numUsers, i);
    let slashAmount = 0;
    if (slash) {
      slashedUsers.push(user.address);
      slashAmount += Number(user.amount) / 2;
    }
    slashTotal += slashAmount;
    return [
      user.address,
      // if shouldSlash, Slash half of the users stake
      slash ? BigInt(slashAmount).toString() : BigInt(0).toString(),
      BigInt(user.stakeId).toString()
    ];
  });

  // Put slash total at the beginning of the merkle tree
  values.unshift([ZERO_ADDRESS, BigInt(slashTotal).toString(), "0"]);

  const merkleTree = StandardMerkleTree.of(values, [
    "address",
    "uint192",
    "uint192"
  ]);

  const merkleRoot = merkleTree.root;

  fs.writeFileSync("slashMerkleTree.json", JSON.stringify(merkleTree.dump()));

  return { merkleRoot, slashTotal, slashedUsers };
};

const getMerkleProof = (address: string, isBadList: boolean) => {
  const fileName = isBadList ? "badList.json" : "slashMerkleTree.json";
  const merkleTree = StandardMerkleTree.load(
    JSON.parse(fs.readFileSync(fileName, "utf8"))
  );

  let proof: any = [];
  for (const [i, v] of merkleTree.entries()) {
    if (v[0] === address) {
      proof = merkleTree.getProof(i);
      console.log("Value:", v);
      console.log("Proof:", proof);
    }
  }

  return proof;
};

function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const fiveMinutes = 5 * 60;
const twelveWeeksInSeconds = 12 * 7 * 24 * 60 * 60 + 1; // 12 weeks in seconds

// Two merkle proofs one that has slash ids
// one that has all slashed amounts and stake ids.

// In order to withdrawal you just need to verify that the stake id is not on a bad list

// If on bad list amount will be withdrawn to the bad list.

// You wouldn't need to do the second one if you just did the first one.

// Need round associated for each merkle proof

// Associate round with merkle proof, merkle proof can be updated with a release.

describe.only("GitcoinIdentityStaking Merkle Slashing", function () {
  this.beforeEach(async function () {
    await reset();
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
  it("should self stake each user", async function () {
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
                  .selfStake(100000, twelveWeeksInSeconds)

              // () =>
              //   gitcoinIdentityStaking
              //     .connect(userAccount)
              //     .communityStake(
              //       this.userAccounts[accountIdx + 1],
              //       100000,
              //       twelveWeeksInSeconds
              //     ),

              // () =>
              //   gitcoinIdentityStaking
              //     .connect(userAccount)
              //     .communityStake(
              //       this.userAccounts[
              //         accountIdx ? accountIdx - 1 : this.userAccounts.length - 1
              //       ],
              //       100000,
              //       twelveWeeksInSeconds
              //     )
            ])) {
              await func();
            }
          })
        );

        // let slashMembers: {
        //   address: string;
        //   amount: string;
        //   stakeId: number;
        // }[] = [];

        const allStakeMembers: StakeMember[] = await Promise.all(
          userAccounts.map(async (userAccount: any) => {
            const stakeId = await gitcoinIdentityStaking.selfStakeIds(
              userAccount.address,
              0
            );
            const amount = (await gitcoinIdentityStaking.stakes(stakeId))[0];
            return {
              address: userAccount.address,
              amount,
              stakeId
            };
          })
        );

        const { merkleRoot, slashTotal, slashedUsers } = buildSlashMerkleTree(
          allStakeMembers,
          numUsers
        );

        const { merkleRoot: badListMerkleRoot } = buildBadListMerkleTree(
          allStakeMembers,
          numUsers
        );

        const slashTotalProof = getMerkleProof(ZERO_ADDRESS, false);

        await gitcoinIdentityStaking
          .connect(this.owner)
          .slash(merkleRoot, badListMerkleRoot, slashTotal, slashTotalProof);

        await time.increaseTo(
          twelveWeeksInSeconds + Math.floor(new Date().getTime() / 1000)
        );

        // withdraw funds for each user
        userAccounts.map(async (userAccount: any) => {
          const stakeId = await gitcoinIdentityStaking.selfStakeIds(
            userAccount.address,
            0
          );
          let amount = (await gitcoinIdentityStaking.stakes(stakeId))[0];
          if (slashedUsers.includes(userAccount.address)) {
            amount = Number(amount) / 2;
          } else {
            amount = 0;
          }

          try {
            const proof = getMerkleProof(userAccount.address, true);
            console.log("Proof:", proof);
            const withdrawTx = await gitcoinIdentityStaking
              .connect(userAccount)
              .withdrawSelfStake(stakeId, BigInt(amount), proof);
          } catch (e) {
            // debugger;
            console.log(e);
          }
        });

        // const slashNonce = keccak256(Buffer.from(Math.random().toString()));

        // const slashProof = makeSlashProof(slashMembers, slashNonce);

        // await gitcoinIdentityStaking
        //   .connect(this.owner)
        //   .slash(stakeIds, 50, slashProof);

        // await gitcoinIdentityStaking
        //   .connect(this.owner)
        //   .release(
        //     slashMembers,
        //     1,
        //     500,
        //     slashProof,
        //     slashNonce,
        //     ethers.keccak256(Buffer.from(Math.random().toString()))
        //   );

        // await time.increase(60 * 60 * 24 * 91);

        // await gitcoinIdentityStaking.connect(this.owner).burn();
      })
    );
  });
  // it("should withdraw each user", async function () {});
});
