// This script deals with deploying the GitcoinAttester on a given network

import { updateDeploymentsFile, getAbi, getEASAddress } from "./utils";
import { deployContract } from "./deployment";

export async function deployAttester() {
  const easAddress = getEASAddress();

  const attester = await deployContract("GitcoinAttester", []);

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
