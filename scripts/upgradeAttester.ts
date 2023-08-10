import hre, { ethers, upgrades } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  updateDeploymentsFile,
  getAbi,
} from "./lib/utils";

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

  const GitcoinAttesterUpdate = await ethers.getContractFactory(
    "GitcoinAttesterUpdate"
  );

  const preparedUpgradeAddress = await upgrades.prepareUpgrade(
    process.env.GITCOIN_ATTESTER_ADDRESS || "",
    GitcoinAttesterUpdate,
    {
      kind: "uups",
      redeployImplementation: "always",
    }
  );

  console.log(
    `✅ Deployed Upgraded GitcoinVerifierUpdate. ${preparedUpgradeAddress}`
  );

  const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
  const gitcoinAttester = await GitcoinAttester.attach(
    process.env.GITCOIN_ATTESTER_ADDRESS || ""
  );

  await updateDeploymentsFile(
    "GitcoinAttester",
    getAbi(GitcoinAttesterUpdate),
    hre.network.config.chainId
  );

  // Encode upgrade transaction
  const upgradeData = gitcoinAttester.interface.encodeFunctionData(
    "upgradeTo",
    [preparedUpgradeAddress]
  );
  console.log(`Upgrade transaction data: ${upgradeData}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
