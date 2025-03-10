// This script deals with deploying the GitcoinResolver on a given network

import hre, { ethers } from "hardhat";
import {
  assertEnvironment,
  confirmContinue,
  getScoreV2Schema,
  getResolverAddress
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
  const tx = await resolverContract.setScoreV2Schema(scoreV2Schema);
  const txReceipt = await tx.wait();

  console.log(
    `✅ Set scoreSchema in GitcoinResolver(${resolverAddress}) to ${scoreV2Schema}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
