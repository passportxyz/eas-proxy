// This script deals with deploying the GitcoinVerifier on a given network

import hre from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getAttesterAddress,
  getIssuerAddress
} from "./lib/utils";
import { deployVerifier } from "./lib/verifier";

assertEnvironment();

export async function main() {
  const attesterAddress = getAttesterAddress();
  const issuerAddress = getIssuerAddress();

  await confirmContinue({
    contract: "GitcoinVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    issuerAddress: issuerAddress,
    attesterAddress: attesterAddress
  });

  await deployVerifier(attesterAddress, issuerAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
