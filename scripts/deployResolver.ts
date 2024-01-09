// This script deals with deploying the GitcoinResolver on a given network

import hre, { ethers, upgrades } from "hardhat";
import {
  assertEnvironment,
  confirmContinue,
  updateDeploymentsFile,
  getAbi,
  getAttesterAddress,
  getEASAddress,
  getScoreSchema
} from "./lib/utils";

assertEnvironment();

export async function main() {
  const attesterAddress = getAttesterAddress();
  const easAddress = getEASAddress();

  await confirmContinue({
    contract: "GitcoinResolver",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    attesterAddress: attesterAddress,
    easAddress: easAddress,
  });


  const GitcoinResolver = await ethers.getContractFactory("GitcoinResolver");
  const resolver = await upgrades.deployProxy(
    GitcoinResolver,
    [easAddress, attesterAddress],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );

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
