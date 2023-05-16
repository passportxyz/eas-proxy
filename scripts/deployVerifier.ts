// This script deals with deploying the GitcoinVerifier on a given network

import hre, { ethers } from "hardhat";
import { assertEnvironment, confirmContinue } from "./utils";

assertEnvironment();

export async function main() {
  if (!process.env.GITCOIN_ATTESTER_ADDRESS) {
    console.error("Please set your GITCOIN_ATTESTER_ADDRESS in a .env file");
  }

  // Wait 10 blocks for re-org protection
  const blocksToWait = hre.network.name === "hardhat" ? 0 : 10;

  await confirmContinue({
    contract: "GitcoinVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const IAM_ISSUER = String(process.env.IAM_ISSUER_ADDRESS);
  const GITCOIN_ATTESTER_ADDRESS = String(process.env.GITCOIN_ATTESTER_ADDRESS);

  const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
  const verifier = await GitcoinVerifier.deploy(
    IAM_ISSUER,
    GITCOIN_ATTESTER_ADDRESS
  );

  console.log(`Deploying GitcoinVerifier to ${verifier.address}`);

  await verifier.deployTransaction.wait(blocksToWait);

  console.log("✅ Deployed GitcoinVerifier.");

  const attester = await ethers.getContractAt(
    "GitcoinAttester",
    GITCOIN_ATTESTER_ADDRESS
  );

  const tx = await attester.addVerifier(verifier.address);
  await tx.wait();

  console.log("✅ Added the verifier to GitcoinAttester allow-list.");

  return verifier.address;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
