// This script deals with deploying the GitcoinAttester on a given network
import { getErrors } from "@openzeppelin/upgrades-core";
import hre, { ethers, upgrades } from "hardhat";
import { updateDeploymentsFile, getAbi, getEASAddress } from "./utils";

export async function deployResolver(
  attesterAddress: string,
  easAddress: string
) {
  const GitcoinResolver = await ethers.getContractFactory("GitcoinResolver");
  const attester = await upgrades.deployProxy(
    GitcoinResolver,
    [easAddress, attesterAddress],
    {
      kind: "uups"
    }
  );

  const deployment = await attester.waitForDeployment();
  const resolverAddress = await deployment.getAddress();

  console.log(`✅ Deployed GitcoinResolver. ${resolverAddress}`);

  console.log(`✅ Deployed GitcoinResolver to ${resolverAddress}.`);

  await updateDeploymentsFile(
    "GitcoinResolver",
    getAbi(deployment),
    resolverAddress
  );

  return deployment;
}
