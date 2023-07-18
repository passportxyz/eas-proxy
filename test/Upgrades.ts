import { ethers, upgrades } from "hardhat";
import { expect } from "chai";

const EAS_CONTRACT_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";

describe("Upgrading GitcoinVerifier", function () {
  this.beforeEach(async function () {
    const [owner, iamAccount, recipientAccount] = await ethers.getSigners();
    this.owner = owner;
    this.iamAccount = iamAccount;
    this.recipientAccount = recipientAccount;
  });
  it("should upgrade GitcoinVerifier and proxy contract", async function () {
    // Deploy GitcoinAttester
    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
    this.gitcoinAttester = await GitcoinAttester.deploy();
    await this.gitcoinAttester.connect(this.owner).initialize();
    await this.gitcoinAttester.setEASAddress(EAS_CONTRACT_ADDRESS);

    const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");

    // Deploy proxy handles the initialize function
    const gitcoinVerifier = await upgrades.deployProxy(GitcoinVerifier, [
      await this.iamAccount.getAddress(),
      await this.gitcoinAttester.getAddress(),
    ]);
    this.gitcoinVerifier = gitcoinVerifier;
    const verifierAddress = await gitcoinVerifier.getAddress();
    this.gitcoinVerifierProxy = gitcoinVerifier;
    expect(verifierAddress).to.not.be.null;
  });
  it("should upgrade GitcoinVerifier implementation", async function () {
    const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
    const upgradedProxy = await upgrades.upgradeProxy(
      await this.gitcoinVerifierProxy.getAddress(),
      GitcoinVerifier
    );
    expect(await upgradedProxy.getAddress()).to.be.equal(
      await this.gitcoinVerifierProxy.getAddress()
    );
  });
  it("should expose public functions from proxy", async function () {
    await this.gitcoinVerifierProxy.connect(this.owner).withdrawFees();
  });
});

describe("Upgrading GitcoinAttester", function () {
  this.beforeEach(async function () {
    const [owner, iamAccount, recipientAccount] = await ethers.getSigners();
    this.owner = owner;
    this.iamAccount = iamAccount;
  });
  it("should deploy GitcoinAttester and proxy contract", async function () {
    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
    const gitcoinAttester = await upgrades.deployProxy(GitcoinAttester);
    const gitcoinVerifierAddress = await gitcoinAttester.getAddress();
    this.attesterProxyAddress = gitcoinVerifierAddress;
    expect(gitcoinVerifierAddress).to.not.be.null;
  });
  it("should upgrade GitcoinAttester implementation", async function () {
    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
    const upgradedProxy = await upgrades.upgradeProxy(
      this.attesterProxyAddress,
      GitcoinAttester
    );
    this.gitcoinAttesterProxy = upgradedProxy;
    expect(await upgradedProxy.getAddress()).to.be.equal(
      this.attesterProxyAddress
    );
  });
  it("should expose public functions from proxy", async function () {
    const newVerifier = "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5";
    await this.gitcoinAttesterProxy
      .connect(this.owner)
      .addVerifier(newVerifier);

    expect(await this.gitcoinAttesterProxy.verifiers(newVerifier)).to.be.equal(
      true
    );
  });
});
