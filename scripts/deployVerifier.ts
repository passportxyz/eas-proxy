// This script deals with deploying the GitcoinVerifier on a given network

import hre, { ethers, upgrades } from "hardhat";
import { assertEnvironment, confirmContinue } from "./utils";

assertEnvironment();

export async function main() {
  if (!process.env.GITCOIN_ATTESTER_ADDRESS) {
    console.error("Please set your GITCOIN_ATTESTER_ADDRESS in a .env file");
  }

  if (!process.env.IAM_ISSUER_ADDRESS) {
    console.error("Please set your IAM_ISSUER_ADDRESS in a .env file");
  }

  // Wait 10 blocks for re-org protection
  const blocksToWait = hre.network.name === "hardhat" ? 0 : 10;

  const IAM_ISSUER = String(process.env.IAM_ISSUER_ADDRESS);
  const GITCOIN_ATTESTER_ADDRESS = String(process.env.GITCOIN_ATTESTER_ADDRESS);

  console.log(
    "IAM_ISSUER_ADDRESS",
    IAM_ISSUER,
    "GITCOIN_ATTESTER_ADDRESS",
    GITCOIN_ATTESTER_ADDRESS
  );

  await confirmContinue({
    contract: "GitcoinVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
  const verifier = await upgrades.deployProxy(GitcoinVerifier, [
    IAM_ISSUER,
    GITCOIN_ATTESTER_ADDRESS,
  ]);

  const deployment = await verifier.waitForDeployment();

  const verifierAddress = await deployment.getAddress();
  console.log(`✅ Deployed GitcoinVerifier to ${verifierAddress}`);

  const attester = await ethers.getContractAt(
    "GitcoinAttester",
    GITCOIN_ATTESTER_ADDRESS
  );

  const tx = await attester.addVerifier(verifierAddress);
  await tx.wait();

  console.log("✅ Added the verifier to GitcoinAttester allow-list.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
