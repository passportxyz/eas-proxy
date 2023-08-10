// This script deals with deploying the GitcoinAttester on a given network
import hre, { ethers, upgrades } from "hardhat";
import { updateDeploymentsFile, getAbi } from "./utils";

export async function deployAttester() {
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

  return deployment;
}
