// This script deals with deploying the GitcoinPassportDecoder on a given network

import hre from "hardhat";
import {
  assertEnvironment,
  confirmContinue,
  updateDeploymentsFile,
  getAbi
} from "./lib/utils";
import { deployContract } from "./lib/deployment";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinPassportDecoder",
    network: hre.network.name,
    chainId: hre.network.config.chainId
  });

  const passportDecoder = await deployContract("GitcoinPassportDecoder", []);

  const deployment = await passportDecoder.waitForDeployment();

  const passportDecoderAddress = await deployment.getAddress();

  console.log(
    `✅ Deployed GitcoinPassportDecoder to ${passportDecoderAddress}.`
  );

  await updateDeploymentsFile(
    "GitcoinPassportDecoder",
    getAbi(deployment),
    passportDecoderAddress
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
