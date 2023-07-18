import hre, { ethers, upgrades, platform } from "hardhat";
import { confirmContinue, assertEnvironment } from "./utils";
import { getProxyAdminFactory } from "@openzeppelin/hardhat-upgrades/dist/utils";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinAttester",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  if (!process.env.GITCOIN_ATTESTER_ADDRESS) {
    console.error("Please set your GITCOIN_ATTESTER_ADDRESS in a .env file");
  }

  if (!process.env.PASSPORT_MULTISIG_ADDRESS) {
    console.error("Please set your PASSPORT_MULTISIG_ADDRESS in a .env file");
  }

  const GitcoinAttesterUpdate = await ethers.getContractFactory(
    "GitcoinAttesterUpdate"
  );
  const gitcoinAttesterUpdate = await GitcoinAttesterUpdate.deploy();
  const deployment = await gitcoinAttesterUpdate.waitForDeployment();
  const deployedUpgradedContractAddress =
    await gitcoinAttesterUpdate.getAddress();
  console.log(
    `✅ Deployed Updated GitcoinAttester. ${deployedUpgradedContractAddress}`
  );

  const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");

  const preparedUpgrade = await upgrades.prepareUpgrade(
    process.env.GITCOIN_ATTESTER_ADDRESS || "",
    GitcoinAttesterUpdate,
    {
      kind: "uups",
    }
  );

  const gitcoinAttester = await GitcoinAttester.attach(
    process.env.GITCOIN_ATTESTER_ADDRESS || ""
  );

  // Encode upgrade transaction
  const upgradeData = gitcoinAttester.interface.encodeFunctionData(
    "upgradeTo",
    [deployedUpgradedContractAddress]
  );
  console.log(`Upgrade transaction data: ${upgradeData}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
