// This script deals with deploying the GitcoinVerifier on a given network

import hre from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getAttesterAddress,
} from "./lib/utils";
import { deployVerifier } from "./lib/verifier";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const attesterAddress = getAttesterAddress();

  await deployVerifier(attesterAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
