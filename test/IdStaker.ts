import { expect } from "chai";
import { ethers } from "hardhat";

describe.only("StakeTest Contract", function () {
  let stakeTest;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    const IdentityStakeGuardian = await ethers.getContractFactory(
      "IdentityStakeGuardian"
    );
    stakeTest = await IdentityStakeGuardian.deploy();
  });

  describe("Adding and verifying values in communityStakeIds", function () {
    it("Should add 5 values and verify one of them", async function () {
      const valuesToAdd = [1, 2, 3, 4, 5];
      await stakeTest.addValuesToCommunityStakeIds(
        owner.address,
        addr1.address,
        valuesToAdd
      );

      // Verify one of the values
      expect(await stakeTest.canUnstake(owner.address, addr1.address, 3)).to.be
        .true;
      expect(await stakeTest.canUnstake(owner.address, addr1.address, 6)).to.be
        .false;
    });
  });

  describe("Adding and verifying values in communityStakeIdsMap", function () {
    it("Should add 5 values and verify one of them", async function () {
      const valuesToAdd = [1, 2, 3, 4, 5];
      await stakeTest.addValuesToCommunityStakeIdsMap(
        owner.address,
        addr1.address,
        valuesToAdd
      );

      // Verify one of the values
      expect(await stakeTest.canUnstakeMap(owner.address, addr1.address, 3)).to
        .be.true;
      expect(await stakeTest.canUnstakeMap(owner.address, addr1.address, 6)).to
        .be.false;
    });
  });
  describe("Adding and verifying values in communityStakeIdsMap", function () {
    it("Should add 5 values and verify one of them", async function () {
      const valuesToAdd = [1, 2, 3, 4, 5];
      await stakeTest.addValuesToCommunityStakeIdsMap(
        owner.address,
        addr1.address,
        valuesToAdd
      );

      // Verify one of the values
      expect(await stakeTest.canUnstakeMap(owner.address, addr1.address, 3)).to
        .be.true;
      expect(await stakeTest.canUnstakeMap(owner.address, addr1.address, 6)).to
        .be.false;
    });
  });
  describe("20 iterations", function () {
    describe("Adding and verifying values in communityStakeIds", function () {
      it("Should add 20 values and verify one of them", async function () {
        const valuesToAdd = Array.from({ length: 20 }, (_, i) => i + 1);
        await stakeTest.addValuesToCommunityStakeIds(
          owner.address,
          addr1.address,
          valuesToAdd
        );

        // Verify one of the values
        expect(await stakeTest.canUnstake(owner.address, addr1.address, 10)).to
          .be.true;
        expect(await stakeTest.canUnstake(owner.address, addr1.address, 21)).to
          .be.false;
      });
    });

    describe("Adding and verifying values in communityStakeIdsMap", function () {
      it("Should add 20 values and verify one of them", async function () {
        const valuesToAdd = Array.from({ length: 20 }, (_, i) => i + 1);
        await stakeTest.addValuesToCommunityStakeIdsMap(
          owner.address,
          addr1.address,
          valuesToAdd
        );

        // Verify one of the values
        expect(await stakeTest.canUnstakeMap(owner.address, addr1.address, 10))
          .to.be.true;
        expect(await stakeTest.canUnstakeMap(owner.address, addr1.address, 21))
          .to.be.false;
      });
    });
  });

  async function addStakes(user, method, count) {
    for (let i = 0; i < count; i++) {
      const stake = { amount: ethers.parseEther("1"), unlockTime: 0 };
      await stakeTest[method](user.address, stake);
    }
  }

  describe.only("Adding stakes and summing active stakes", function () {
    it("Should add and sum 5 stakes using selfStakeIds", async function () {
      await addStakes(owner, "addSelfStake", 5);
      await stakeTest.sumActiveSelfStake(owner.address);
      expect(await stakeTest.activeStake()).to.equal(ethers.parseEther("5"));
    });

    it("Should add and sum 20 stakes using selfStakeIds", async function () {
      await addStakes(owner, "addSelfStake", 20);
      await stakeTest.sumActiveSelfStake(owner.address);
      expect(await stakeTest.activeStake()).to.equal(ethers.parseEther("20"));
    });

    it("Should add and sum 5 stakes using selfStakeIdsMap", async function () {
      await addStakes(owner, "addSelfStakeMap", 5);
      await stakeTest.sumActiveSelfStakeMap(owner.address);
      expect(await stakeTest.activeStake()).to.equal(ethers.parseEther("5"));
    });

    it("Should add and sum 20 stakes using selfStakeIdsMap", async function () {
      await addStakes(owner, "addSelfStakeMap", 20);
      await stakeTest.sumActiveSelfStakeMap(owner.address);
      expect(await stakeTest.activeStake()).to.equal(ethers.parseEther("20"));
    });
  });
});
