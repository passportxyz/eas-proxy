// This script deals with deploying the GitcoinResolver on a given network

import hre, { ethers } from "hardhat";
import {
  assertEnvironment,
  confirmContinue,
  getResolverAddress,
  getScoreV2Schema
} from "./lib/utils";

assertEnvironment();

export async function main() {
  const scoreV2Schema = getScoreV2Schema();
  const resolverAddress = getResolverAddress();

  await confirmContinue({
    contract: "GitcoinResolver",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    scoreV2Schema
  });

  const resolverContract = await ethers.getContractAt(
    "GitcoinResolver",
    resolverAddress
  );

  const upgradeData = resolverContract.interface.encodeFunctionData(
    "setScoreV2Schema",
    [scoreV2Schema]
  );
  console.log(`'setScoreV2Schema' transaction data: ${upgradeData}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
