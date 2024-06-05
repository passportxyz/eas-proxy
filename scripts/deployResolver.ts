// This script deals with deploying the GitcoinResolver on a given network

import hre, { ethers, upgrades } from "hardhat";
import {
  assertEnvironment,
  confirmContinue,
  getAttesterAddress,
  getEASAddress
} from "./lib/utils";

import { deployResolver } from "./lib/resolver";
import { deployZkSyncResolver } from "./lib/zk-resolver";

assertEnvironment();

export async function main() {
  const attesterAddress = getAttesterAddress();
  const easAddress = getEASAddress();

  await confirmContinue({
    contract: "GitcoinResolver",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    attesterAddress: attesterAddress,
    easAddress: easAddress
  });

  if (hre.network.zksync) {
    deployZkSyncResolver(attesterAddress, easAddress);
  } else {
    deployResolver(attesterAddress, easAddress);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
