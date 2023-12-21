// This script deals with deploying the GitcoinVerifier on a given network

import hre from "hardhat";
import {
  assertEnvironment,
  confirmContinue,
  getEASAddress,
  getIssuerAddress
} from "./lib/utils";
import { deployAttester } from "./lib/attester";
import { deployVerifier } from "./lib/verifier";

assertEnvironment();

export async function main() {
  const issuerAddress = getIssuerAddress();
  const easAddress = getEASAddress();
  await confirmContinue({
    contract: "GitcoinAttester and GitcoinVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    issuerAddress: issuerAddress,
    easAddress: easAddress
  });

  // console.log("🚀 Deploying GitcoinAttester...");
  // const attester = await deployAttester();
  const attesterAddress = "0x8B1A76795e3CbadD79C5410d2C4D4827D9C1503a";
  // const attesterAddress = await attester.getAddress();

  console.log("🚀 Deploying GitcoinVerifier...");
  const verifier = await deployVerifier(attesterAddress, issuerAddress);

  // console.log("🚀 adding Verifier to attester ...");
  // await attester.addVerifier(await verifier.getAddress());
  // console.log("✅ Added verifier to attester");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
