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

type SlashMember = {
  address: string;
  slashAmount: string;
  stakeId: number;
};

const shouldSlash = (numUsers: number, i: number): boolean =>
  i < Math.floor((numUsers * 3) / 10);

// https://github.com/OpenZeppelin/merkle-tree
const buildSlashMerkleTree = (
  users: SlashMember[]
): {
  merkleRoot: string;
  slashTotal: number;
  merkleTree: StandardMerkleTree<[string, string, string]>;
} => {
  let slashTotal = 0;
  const values: [string, string, string][] = users.map((user, i) => {
    slashTotal += Number(user.slashAmount);
    return [
      user.address,
      // if shouldSlash, Slash half of the users stake
      BigInt(user.slashAmount).toString(),
      BigInt(user.stakeId).toString()
    ];
  });

  // Put slash total at the beginning of the merkle tree
  values.unshift([ZERO_ADDRESS, BigInt(slashTotal).toString(), "0"]);

  const merkleTree = StandardMerkleTree.of(values, [
    "address",
    "uint192",
    "uint256"
  ]);

  const merkleRoot = merkleTree.root;

  fs.writeFileSync("slashMerkleTree.json", JSON.stringify(merkleTree.dump()));

  return { merkleRoot, slashTotal, merkleTree };
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
    const gitcoinIdentityStaking = this.gitcoinIdentityStaking;

    gitcoinIdentityStaking.grantRole(
      await gitcoinIdentityStaking.SLASHER_ROLE(),
      this.owner.address
    );
    gitcoinIdentityStaking.grantRole(
      await gitcoinIdentityStaking.RELEASER_ROLE(),
      this.owner.address
    );

    const allStakeMembers: SlashMember[] = [];
    let totalSlashAmount = BigInt(0);

    for (let i = 0; i < 20; i++) {
      const userAccount = this.userAccounts[i];
      ///////////////////////////
      // Stake user i
      ///////////////////////////
      const selfStakeTx = await gitcoinIdentityStaking
        .connect(userAccount)
        .selfStake(100000, twelveWeeksInSeconds);
      await selfStakeTx.wait();

      allStakeMembers.push({
        address: userAccount.address,
        // Slash half
        slashAmount: "50000",
        stakeId: Number(await gitcoinIdentityStaking.stakeCount())
      });

      totalSlashAmount += BigInt(50000);
    }

    console.log("allStakeMembers", allStakeMembers);
    const { merkleRoot, slashTotal, merkleTree } =
      buildSlashMerkleTree(allStakeMembers);

    ///////////////////////////
    // Set merkle root
    ///////////////////////////
    const setMerkleRootTx = await gitcoinIdentityStaking.setMerkleRoot(
      merkleRoot
    );
    await setMerkleRootTx.wait();

    ///////////////////////////
    // Fast forward
    ///////////////////////////
    await time.increaseTo(
      twelveWeeksInSeconds +
        twelveWeeksInSeconds +
        Math.floor(new Date().getTime() / 1000)
    );

    ///////////////////////////
    // Withdraw user 1
    ///////////////////////////
    const user1Proof = merkleTree.getProof([
      allStakeMembers[0].address,
      allStakeMembers[0].slashAmount,
      allStakeMembers[0].stakeId.toString()
    ]); // This here is the tree index ...
    console.log("Proof:", user1Proof);
    console.log("First user:", allStakeMembers[0]);
    await gitcoinIdentityStaking
      .connect(this.userAccounts[0])
      .withdrawSelfStake(
        allStakeMembers[0].stakeId,
        allStakeMembers[0].slashAmount,
        user1Proof
      );

    ///////////////////////////
    // Slash amounts
    ///////////////////////////
    await gitcoinIdentityStaking
      .connect(this.owner)
      .slash(merkleRoot, totalSlashAmount.toString());

    await gitcoinIdentityStaking
      .connect(this.owner)
      .updateSlashingRound(0, merkleRoot, totalSlashAmount.toString());

    await gitcoinIdentityStaking.connect(this.owner).burn();
  });

  it("should self stake each user - minimal", async function () {
    const userAccount1 = this.userAccounts[0];
    const gitcoinIdentityStaking = this.gitcoinIdentityStaking;

    gitcoinIdentityStaking.grantRole(
      await gitcoinIdentityStaking.SLASHER_ROLE(),
      this.owner.address
    );
    gitcoinIdentityStaking.grantRole(
      await gitcoinIdentityStaking.RELEASER_ROLE(),
      this.owner.address
    );

    const allStakeMembers: SlashMember[] = [];
    let totalSlashAmount = BigInt(0);

    for (let i = 0; i < 20; i++) {
      const userAccount = this.userAccounts[i];
      ///////////////////////////
      // Stake user i
      ///////////////////////////
      const selfStakeTx = await gitcoinIdentityStaking
        .connect(userAccount)
        .selfStakeMinimal(100000, twelveWeeksInSeconds);
      await selfStakeTx.wait();
      const stakeId = Number(await gitcoinIdentityStaking.stakeCount());

      allStakeMembers.push({
        address: userAccount.address,
        // Slash half
        slashAmount: "50000",
        stakeId: stakeId
      });
      totalSlashAmount += BigInt(50000);

      const stake = await gitcoinIdentityStaking.stakes(stakeId);
      console.log("Stake: ", stake);
    }

    console.log("allStakeMembers", allStakeMembers);
    const { merkleRoot, slashTotal, merkleTree } =
      buildSlashMerkleTree(allStakeMembers);

    ///////////////////////////
    // Set merkle root
    ///////////////////////////
    const setMerkleRootTx = await gitcoinIdentityStaking.setMerkleRoot(
      merkleRoot
    );
    await setMerkleRootTx.wait();

    ///////////////////////////
    // Fast forward
    ///////////////////////////
    await time.increaseTo(
      twelveWeeksInSeconds +
        twelveWeeksInSeconds +
        Math.floor(new Date().getTime() / 1000)
    );

    ///////////////////////////
    // Withdraw user 1
    ///////////////////////////
    const user1Proof = merkleTree.getProof([
      allStakeMembers[0].address,
      allStakeMembers[0].slashAmount,
      allStakeMembers[0].stakeId.toString()
    ]); // This here is the tree index ...
    console.log("Proof:", user1Proof);
    console.log("First user:", allStakeMembers[0]);
    await gitcoinIdentityStaking
      .connect(userAccount1)
      .withdrawSelfStake(
        allStakeMembers[0].stakeId,
        allStakeMembers[0].slashAmount,
        user1Proof
      );

    ///////////////////////////
    // Slash amounts
    ///////////////////////////
    await gitcoinIdentityStaking
      .connect(this.owner)
      .slashAndCheck(
        merkleRoot,
        totalSlashAmount.toString(),
        [
          allStakeMembers[1].stakeId,
          allStakeMembers[2].stakeId,
          allStakeMembers[3].stakeId,
          allStakeMembers[4].stakeId,
          allStakeMembers[5].stakeId,
          allStakeMembers[6].stakeId,
          allStakeMembers[7].stakeId,
          allStakeMembers[8].stakeId,
          allStakeMembers[9].stakeId,
          allStakeMembers[10].stakeId
        ],
        [
          allStakeMembers[1].slashAmount,
          allStakeMembers[2].slashAmount,
          allStakeMembers[3].slashAmount,
          allStakeMembers[4].slashAmount,
          allStakeMembers[5].slashAmount,
          allStakeMembers[6].slashAmount,
          allStakeMembers[7].slashAmount,
          allStakeMembers[8].slashAmount,
          allStakeMembers[9].slashAmount,
          allStakeMembers[10].slashAmount
        ]
      );

    await gitcoinIdentityStaking
      .connect(this.owner)
      .updateSlashingRound(0, merkleRoot, totalSlashAmount.toString());

    await gitcoinIdentityStaking.connect(this.owner).burn();
  });
});
