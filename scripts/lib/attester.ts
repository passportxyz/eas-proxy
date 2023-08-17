// This script deals with deploying the GitcoinAttester on a given network
import { getErrors } from "@openzeppelin/upgrades-core";
import hre, { ethers, upgrades } from "hardhat";
import { updateDeploymentsFile, getAbi, getEASAddress } from "./utils";

export async function deployAttester() {
  const easAddress = getEASAddress();
  const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
  const attester = await upgrades.deployProxy(GitcoinAttester, {
    kind: "uups",
  });

  const deployment = await attester.waitForDeployment();
  const deployedAddress = await deployment.getAddress();

  console.log(`✅ Deployed GitcoinAttester. ${deployedAddress}`);

  await updateDeploymentsFile(
    "GitcoinAttester",
    getAbi(deployment),
    deployedAddress
  );

  await deployment.setEASAddress(easAddress);
  console.log(`✅ Set EAS address ${easAddress} on GitcoinAttester.`);

  return deployment;
}
