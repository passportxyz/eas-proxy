// This script deals with deploying the GitcoinResolver on a given network

import hre from "hardhat";
import {
  assertEnvironment,
  confirmContinue,
  getAttesterAddress,
  getEASAddress,
  updateDeploymentsFile,
  getAbi
} from "./lib/utils";
import { deployContract } from "./lib/deployment";

assertEnvironment();

export async function main() {
  const attesterAddress = getAttesterAddress();
  const easAddress = getEASAddress();

  await confirmContinue({
    contract: "GitcoinResolver",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    attesterAddress: attesterAddress,
    easAddress: easAddress
  });

  const resolver = await deployContract("GitcoinResolver", [easAddress, attesterAddress], {
    kind: "uups",
    initializer: "initialize"
  });
  const deployment = await resolver.waitForDeployment();

  const resolverAddress = await deployment.getAddress();

  console.log(`✅ Deployed GitcoinResolver to ${resolverAddress}.`);

  await updateDeploymentsFile(
    "GitcoinResolver",
    getAbi(deployment),
    resolverAddress
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
