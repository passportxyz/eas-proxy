// This script deals with deploying the GitcoinResolver on a given network

import hre, { ethers } from "hardhat";
import {
  assertEnvironment,
  confirmContinue,
  getScoreSchema,
  getResolverAddress
} from "./lib/utils";

assertEnvironment();

export async function main() {
  const scoreSchema = getScoreSchema();
  const resolverAddress = getResolverAddress();

  await confirmContinue({
    contract: "GitcoinResolver",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    scoreSchema: scoreSchema
  });

  const resolverContract = await ethers.getContractAt(
    "GitcoinResolver",
    resolverAddress
  );

  // Encode upgrade transaction
  const upgradeData = resolverContract.interface.encodeFunctionData(
    "setScoreSchema",
    [scoreSchema]
  );
  console.log(`'setScoreSchema' transaction data: ${upgradeData}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
