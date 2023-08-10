// This script deals with deploying the GitcoinAttester on a given network
import hre from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  transferOwnershipToMultisig,
} from "./lib/utils";

import { deployAttester } from "./lib/attester";

assertEnvironment();

if (!process.env.PASSPORT_MULTISIG_ADDRESS) {
  console.error("Please set your PASSPORT_MULTISIG_ADDRESS in a .env file");
}

export async function main() {
  await confirmContinue({
    contract: "GitcoinAttester",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const deployment = await deployAttester();
  await transferOwnershipToMultisig(deployment);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
