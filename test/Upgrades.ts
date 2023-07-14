import { ethers, upgrades } from "hardhat";
import { expect } from "chai";

const EAS_CONTRACT_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
const GITCOIN_STAMP_SCHEMA =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";
const GITCOIN_SCORE_SCHEMA =
  "0x0f2928937d46e9ec78b350750185d2f495e708f79b383cef23b903fe120d9a2e";

describe("Upgrading GitcoinVerifier", function () {
  this.beforeEach(async function () {
    const [owner, iamAccount, recipientAccount] = await ethers.getSigners();
    this.owner = owner;
    this.iamAccount = iamAccount;
  });
  it("Should upgrade GitcoinVerifier", async function () {
    // Deploy GitcoinAttester
    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
    this.gitcoinAttester = await GitcoinAttester.deploy();
    await this.gitcoinAttester.connect(this.owner).initialize();
    await this.gitcoinAttester.setEASAddress(EAS_CONTRACT_ADDRESS);

    const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
    const gitcoinVerifier = await upgrades.deployProxy(GitcoinVerifier, [
      await this.iamAccount.getAddress(),
      await this.gitcoinAttester.getAddress(),
    ]);

    expect(await gitcoinVerifier.getAddress()).to.not.be.null;
  });
});

describe("Upgrading GitcoinAttester", function () {
  this.beforeEach(async function () {
    const [owner, iamAccount, recipientAccount] = await ethers.getSigners();
    this.owner = owner;
    this.iamAccount = iamAccount;
  });
  it("Should upgrade GitcoinVerifier", async function () {
    // Deploy GitcoinAttester

    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
    const gitcoinAttester = await upgrades.deployProxy(GitcoinAttester);

    expect(await gitcoinAttester.getAddress()).to.not.be.null;
  });
});
