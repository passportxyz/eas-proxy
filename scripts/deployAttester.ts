// This script deals with deploying the GitcoinAttester on a given network
import hre, { ethers, upgrades } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  updateDeploymentsFile,
  getAbi,
} from "./utils";

assertEnvironment();

if (!process.env.PASSPORT_MULTISIG_ADDRESS) {
  console.error("Please set your PASSPORT_MULTISIG_ADDRESS in a .env file");
}

export async function main() {
  // Wait 10 blocks for re-org protection
  const blocksToWait = hre.network.name === "hardhat" ? 0 : 10;

  await confirmContinue({
    contract: "GitcoinAttester",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  // Deploy GitcoinAttester
  const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
  const attester = await upgrades.deployProxy(GitcoinAttester, {
    kind: "uups",
  });

  const deployment = await attester.waitForDeployment();
  const deployedAddress = await attester.getAddress();

  console.log(`✅ Deployed GitcoinAttester. ${deployedAddress}`);

  await updateDeploymentsFile(
    "GitcoinAttester",
    getAbi(deployment),
    hre.network.config.chainId,
    deployedAddress
  );

  const transferProxyOwnerShip = await deployment.transferOwnership(
    process.env.PASSPORT_MULTISIG_ADDRESS || ""
  );

  console.log("Ownership Transferred");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
