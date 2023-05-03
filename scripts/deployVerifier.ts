// This script deals with deploying the Verifier on a given network
import hre, { ethers } from "hardhat";
import { confirmContinue, assertEnvironment } from "./utils";

assertEnvironment();

export async function main() {
  // Wait 10 blocks for re-org protection
  const blocksToWait = hre.network.name === "localhost" ? 0 : 10;

  await confirmContinue({
    contract: "Verifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  // Deploy Verifier
  const Verifier = await ethers.getContractFactory("Verifier");
  const contract = await Verifier.deploy(
    process.env.IAM_ISSUER_ADDRESS as string
  );

  console.log(`Deploying Verifier to ${contract.address}`);

  await contract.deployTransaction.wait(blocksToWait);

  console.log("✅ Deployed.");

  return contract.address;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
