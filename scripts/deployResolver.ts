// This script deals with deploying the GitcoinResolver on a given network

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

  if (!process.env.PASSPORT_MULTISIG_ADDRESS) {
    console.error("Please set your PASSPORT_MULTISIG_ADDRESS in a .env file");
  }

  // Wait 10 blocks for re-org protection
  const blocksToWait = hre.network.name === "hardhat" ? 0 : 10;

  await confirmContinue({
    contract: "GitcoinResolver",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const EAS_CONTRACT_ADDRESS = String(process.env.EAS_CONTRACT_ADDRESS);
  const GITCOIN_ATTESTER_ADDRESS = String(process.env.GITCOIN_ATTESTER_ADDRESS);

  const GitcoinResolver = await ethers.getContractFactory("GitcoinResolver");
  const resolver = await upgrades.deployProxy(
    GitcoinResolver,
    [EAS_CONTRACT_ADDRESS, GITCOIN_ATTESTER_ADDRESS],
    {
      kind: "uups",
    }
  );

  const deployment = await resolver.waitForDeployment();

  const resolverAddress = await deployment.getAddress();

  console.log(`✅ Deployed GitcoinResolver to ${resolverAddress}.`);

  const transferProxyOwnerShip = await deployment.transferOwnership(
    process.env.PASSPORT_MULTISIG_ADDRESS || ""
  );
  console.log("✅ Transfered ownership of GitcoinVerifier to multisig");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});