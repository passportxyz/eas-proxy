// This script deals with deploying the GitcoinAttester on a given network
import hre, { ethers } from "hardhat";
import { confirmContinue, assertEnvironment } from "./utils";

assertEnvironment();

// Wait 10 blocks for re-org protection
const blocksToWait = hre.network.name === "hardhat" ? 0 : 10;

async function deployGitcoinAttester() {
  await confirmContinue({
    contract: "GitcoinAttester",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  // Deploy GitcoinAttester
  const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
  const attester = await GitcoinAttester.deploy();

  console.log(`Deploying GitcoinAttester to ${attester.address}`);

  await attester.deployTransaction.wait(blocksToWait);

  return attester;
}

async function deployVerifier(issuer: string, attester: string) {
  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = await Verifier.deploy(issuer, attester);

  console.log(`Deploying Verifier to ${verifier.address}`);

  await verifier.deployTransaction.wait(blocksToWait);

  return verifier;
}

export async function main() {
  const attester = await deployGitcoinAttester();

  console.log("✅ Deployed Gitcoin Attester.");

  const verifier = await deployVerifier(
    String(process.env.IAM_ISSUER_ADDRESS),
    attester.address
  );

  console.log("✅ Deployed Verifier.");

  const tx = await attester.addVerifier(verifier.address);
  await tx.wait();

  console.log("✅ Added Verifier to Attester.")
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
