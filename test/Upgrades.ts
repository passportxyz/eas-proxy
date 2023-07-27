import { ethers, upgrades } from "hardhat";
import { expect } from "chai";

const IAM_ISSUER = String(
  process.env.IAM_ISSUER_ADDRESS || "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"
);
const GITCOIN_ATTESTER_ADDRESS = String(
  process.env.GITCOIN_ATTESTER_ADDRESS ||
    "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"
);

describe("Upgrading GitcoinVerifier", function () {
  this.beforeEach(async function () {
    const [owner, iamAccount, recipientAccount] = await ethers.getSigners();
    this.owner = owner;
    this.iamAccount = iamAccount;
    this.recipientAccount = recipientAccount;
  });
  it("should deploy GitcoinVerifier and proxy contract", async function () {
    const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
    const gitcoinVerifier = await upgrades.deployProxy(
      GitcoinVerifier,
      [IAM_ISSUER, GITCOIN_ATTESTER_ADDRESS],
      {
        kind: "uups",
      }
    );
    const gitcoinVerifierAddress = await gitcoinVerifier.getAddress();
    this.verifierProxyAddress = gitcoinVerifierAddress;
    this.gitcoinVerifierProxy = gitcoinVerifier;
    expect(gitcoinVerifierAddress).to.not.be.null;
  });
  it("should upgrade GitcoinVerifier", async function () {
    const GitcoinVerifierUpdate = await ethers.getContractFactory(
      "GitcoinVerifierUpdate"
    );

    const preparedUpgradeAddress = await upgrades.prepareUpgrade(
      this.verifierProxyAddress,
      GitcoinVerifierUpdate,
      {
        kind: "uups",
        redeployImplementation: "always",
      }
    );

    const upgradeCall = await this.gitcoinVerifierProxy.upgradeTo(
      preparedUpgradeAddress as string
    );

    expect(await this.gitcoinVerifierProxy.getAddress()).to.be.equal(
      this.verifierProxyAddress
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
    const gitcoinAttester = await upgrades.deployProxy(GitcoinAttester, {
      kind: "uups",
    });
    const gitcoinVerifierAddress = await gitcoinAttester.getAddress();
    this.attesterProxyAddress = gitcoinVerifierAddress;
    this.gitcoinAttesterProxy = gitcoinAttester;
    expect(gitcoinVerifierAddress).to.not.be.null;
  });
  it("should upgrade GitcoinAttester implementation", async function () {
    const GitcoinAttesterUpdate = await ethers.getContractFactory(
      "GitcoinAttesterUpdate"
    );

    const preparedUpgradeAddress = await upgrades.prepareUpgrade(
      this.attesterProxyAddress,
      GitcoinAttesterUpdate,
      {
        kind: "uups",
        redeployImplementation: "always",
      }
    );

    const upgradeCall = await this.gitcoinAttesterProxy.upgradeTo(
      preparedUpgradeAddress as string
    );

    expect(await this.gitcoinAttesterProxy.getAddress()).to.be.equal(
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

describe("Upgrading GitcoinResolver", function () {
  this.beforeEach(async function () {
    const [owner, mockEASAccount] = await ethers.getSigners();
    this.owner = owner;
    this.mockEAS = mockEASAccount;
  });

  it("should deploy GitcoinResolver and proxy contract", async function () {
    const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
    const gitcoinAttester = await upgrades.deployProxy(GitcoinAttester, {
      kind: "uups",
    });
    const gitcoinAttesterAddress = await gitcoinAttester.getAddress();

    const GitcoinResolver = await ethers.getContractFactory("GitcoinResolver");
    const gitcoinResolver = await upgrades.deployProxy(
      GitcoinResolver,
      [this.mockEAS.address, gitcoinAttesterAddress],
      {
        kind: "uups",
      }
    );
    const gitcoinResolverAddress = await gitcoinResolver.getAddress();
    this.resolverProxyAddress = gitcoinResolverAddress;
    this.gitcoinResolverProxy = gitcoinResolver;
    expect(gitcoinResolverAddress).to.not.be.null;
  });

  it("should upgrade GitcoinResolver implementation", async function () {
    const GitcoinResolverUpdate = await ethers.getContractFactory(
      "GitcoinResolverUpdate"
    );

    const preparedUpgradeAddress = await upgrades.prepareUpgrade(
      this.resolverProxyAddress,
      GitcoinResolverUpdate,
      {
        kind: "uups",
        redeployImplementation: "always",
      }
    );

    const upgradeCall = await this.gitcoinResolverProxy.upgradeTo(
      preparedUpgradeAddress as string
    );
    expect(await this.gitcoinResolverProxy.getAddress()).to.be.equal(
      this.resolverProxyAddress
    );
  });
});