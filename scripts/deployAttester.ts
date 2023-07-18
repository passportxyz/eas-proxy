// This script deals with deploying the BaseAttester on a given network
import hre, { ethers } from "hardhat";
import { assertEnvironment, confirmContinue } from "./utils";

assertEnvironment();

export async function main() {
  // Wait 10 blocks for re-org protection
  const blocksToWait = hre.network.name === "hardhat" ? 0 : 10;

  await confirmContinue({
    contract: "BaseAttester",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  // Deploy BaseAttester
  const BaseAttester = await ethers.getContractFactory("BaseAttester");
  const attester = await BaseAttester.deploy();

  console.log(`Deploying BaseAttester to ${attester.address}`);

  await attester.deployTransaction.wait(blocksToWait);

  console.log("✅ Deployed BaseAttester.");

  return attester.address;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
