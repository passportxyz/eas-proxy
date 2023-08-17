// This script deals with deploying the GitcoinVerifier on a given network

import hre from "hardhat";
import { assertEnvironment, confirmContinue } from "./lib/utils";
import { deployAttester } from "./lib/attester";
import { deployVerifier } from "./lib/verifier";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinAttester and GitcoinVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const attester = await deployAttester();
  const verifier = await deployVerifier(await attester.getAddress());

  await attester.addVerifier(await verifier.getAddress());
  console.log("✅ Added verifier to attester");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
