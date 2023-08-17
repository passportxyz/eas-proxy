// This script deals with deploying the GitcoinVerifier on a given network

import hre, { ethers, upgrades } from "hardhat";
import { getAbi, updateDeploymentsFile } from "./utils";

export async function deployVerifier(
  attesterAddress: string,
  issuerAddress: string
) {
  const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
  const verifier = await upgrades.deployProxy(
    GitcoinVerifier,
    [issuerAddress, attesterAddress],
    {
      kind: "uups",
    }
  );

  const deployment = await verifier.waitForDeployment();

  const verifierAddress = await deployment.getAddress();
  console.log(`✅ Deployed GitcoinVerifier to ${verifierAddress}`);

  await updateDeploymentsFile(
    "GitcoinVerifier",
    getAbi(deployment),
    verifierAddress
  );

  return deployment;
}
