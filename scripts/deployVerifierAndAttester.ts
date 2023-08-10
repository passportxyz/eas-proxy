// This script deals with deploying the GitcoinVerifier on a given network

import hre from "hardhat";
import {
  assertEnvironment,
  confirmContinue,
  transferOwnershipToMultisig,
} from "./lib/utils";
import { deployAttester } from "./lib/attester";
import { deployVerifier } from "./lib/verifier";

assertEnvironment();

export async function main() {
  if (!process.env.IAM_ISSUER_ADDRESS) {
    console.error("Please set your IAM_ISSUER_ADDRESS in a .env file");
  }

  if (!process.env.PASSPORT_MULTISIG_ADDRESS) {
    console.error("Please set your PASSPORT_MULTISIG_ADDRESS in a .env file");
  }

  await confirmContinue({
    contract: "GitcoinAttester and GitcoinVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const attester = await deployAttester();
  const verifier = await deployVerifier(await attester.getAddress());

  await attester.addVerifier(await verifier.getAddress());
  console.log("✅ Added verifier to attester");

  transferOwnershipToMultisig(attester);
  transferOwnershipToMultisig(verifier);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
