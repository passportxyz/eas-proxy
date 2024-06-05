// This script deals with deploying the GitcoinResolver on a given network

import hre from "hardhat";
import {
  assertEnvironment,
  confirmContinue,
  getAttesterAddress,
  getEASAddress
} from "./lib/utils";
import { deployContract } from "./lib/deployment";

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

  deployContract("GitcoinResolver", [attesterAddress, easAddress], {
    kind: "uups",
    initializer: "initialize"
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
