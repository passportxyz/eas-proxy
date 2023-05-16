// This script deals with deploying the GitcoinAttester on a given network
import hre, { ethers } from "hardhat";
import { confirmContinue, assertEnvironment } from "./utils";

assertEnvironment();

export async function main() {
  // Wait 10 blocks for re-org protection
  const blocksToWait = hre.network.name === "hardhat" ? 0 : 10;

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

  console.log("✅ Deployed GitcoinAttester.");

  return attester.address;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
