// This script deals with deploying the GitcoinAttester on a given network
import hre from "hardhat";
import { confirmContinue, assertEnvironment } from "./lib/utils";

import { deployAttester } from "./lib/attester";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinAttester",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  deployAttester();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
