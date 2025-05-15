// This script deals with deploying the GitcoinVerifier on a given network

import hre from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getAttesterAddress,
  getIssuerAddress,
  getFeeAddress
} from "./lib/utils";
import { deployVerifier } from "./lib/verifier";

assertEnvironment();

export async function main() {
  const attesterAddress = getAttesterAddress();
  const issuerAddress = getIssuerAddress();
  const feeAddress = getFeeAddress();

  await confirmContinue({
    contract: "GitcoinVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    issuerAddress: issuerAddress,
    attesterAddress: attesterAddress,
    feeAddress: feeAddress
  });

  await deployVerifier(attesterAddress, issuerAddress, feeAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
