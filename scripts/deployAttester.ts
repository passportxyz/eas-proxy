// This script deals with deploying the GitcoinAttester on a given network
import hre, { ethers, upgrades } from "hardhat";
import { confirmContinue, assertEnvironment } from "./utils";

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
  const attester = await upgrades.deployProxy(GitcoinAttester);

  const deployment = await attester.waitForDeployment();
  const deployedAddress = await attester.getAddress();

  const transferOwnershipTx = await upgrades.admin.transferProxyAdminOwnership(
    process.env.PASSPORT_MULTISIG_ADDRESS || ""
  );

  console.log(`✅ Deployed GitcoinAttester. ${deployedAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
