// This script deals with deploying the GitcoinAttester on a given network
import hre, { ethers } from "hardhat";
import { confirmContinue, assertEnvironment } from "./utils";

assertEnvironment();

export async function main() {
  // Wait 10 blocks for re-org protection
  const blocksToWait = hre.network.name === "localhost" ? 0 : 10;

  await confirmContinue({
    contract: "GitcoinAttester",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  // Deploy GitcoinAttester
  const gitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
  const contract = await gitcoinAttester.deploy(
    process.env.IAM_ISSUER_ADDRESS as string
  );

  console.log(`Deploying GitcoinAttester to ${contract.address}`);

  await contract.deployTransaction.wait(blocksToWait);

  console.log("✅ Deployed.");

  return contract.address;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
