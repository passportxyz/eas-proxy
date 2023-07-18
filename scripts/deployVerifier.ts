// This script deals with deploying the BaseVerifier on a given network

import hre, { ethers } from "hardhat";
import { assertEnvironment, confirmContinue } from "./utils";

assertEnvironment();

export async function main() {
  if (!process.env.ATTESTER_ADDRESS) {
    console.error("Please set your _ATTESTER_ADDRESS in a .env file");
  }

  // Wait 10 blocks for re-org protection
  const blocksToWait = hre.network.name === "hardhat" ? 0 : 10;

  await confirmContinue({
    contract: "BaseVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const IAM_ISSUER = String(process.env.IAM_ISSUER_ADDRESS);
  const ATTESTER_ADDRESS = String(process.env._ATTESTER_ADDRESS);

  const BaseVerifier = await ethers.getContractFactory("BaseVerifier");
  const verifier = await BaseVerifier.deploy(
    IAM_ISSUER,
    ATTESTER_ADDRESS
  );

  console.log(`Deploying BaseVerifier to ${verifier.address}`);

  await verifier.deployTransaction.wait(blocksToWait);

  console.log("✅ Deployed BaseVerifier.");

  const attester = await ethers.getContractAt(
    "BaseAttester",
    ATTESTER_ADDRESS
  );

  const tx = await attester.addVerifier(verifier.address);
  await tx.wait();

  console.log("✅ Added the verifier to BaseAttester allow-list.");

  return verifier.address;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
