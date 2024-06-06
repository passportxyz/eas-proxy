// This script deals with deploying the GitcoinVerifier on a given network

import { getAbi, updateDeploymentsFile } from "./utils";
import { deployContract } from "./deployment";

export async function deployVerifier(
  attesterAddress: string,
  issuerAddress: string
) {
  const verifier = await deployContract("GitcoinVerifier", [
    issuerAddress,
    attesterAddress
  ]);

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
