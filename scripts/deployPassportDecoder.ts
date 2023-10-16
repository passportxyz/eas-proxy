// This script deals with deploying the GitcoinPassportDecoder on a given network

import hre, { ethers, upgrades } from "hardhat";
import {
  assertEnvironment,
  confirmContinue,
  updateDeploymentsFile,
  getAbi,
  getAttesterAddress,
  getEASAddress,
  getResolverAddress,
} from "./lib/utils";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinPassportDecoder",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const GitcoinPassportDecoder = await ethers.getContractFactory("GitcoinPassportDecoder");
  const passportDecoder = await upgrades.deployProxy(
    GitcoinPassportDecoder,
    {
      initializer: "initialize",
      kind: "uups",
    }
  );

  const deployment = await passportDecoder.waitForDeployment();

  const passportDecoderAddress = await deployment.getAddress();

  console.log(`✅ Deployed GitcoinPassportDecoder to ${passportDecoderAddress}.`);

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
