import hre, { ethers, upgrades } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  updateDeploymentsFile,
  getAbi,
  getAttesterAddress,
} from "./lib/utils";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinAttester",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const GitcoinAttesterUpdate = await ethers.getContractFactory(
    "GitcoinAttesterUpdate"
  );

  const attesterAddress = getAttesterAddress();

  const preparedUpgradeAddress = await upgrades.prepareUpgrade(
    attesterAddress,
    GitcoinAttesterUpdate,
    {
      kind: "uups",
      redeployImplementation: "always",
    }
  );

  console.log(
    `✅ Deployed Upgraded GitcoinAttesterUpdate. ${preparedUpgradeAddress}`
  );

  const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
  const gitcoinAttester = GitcoinAttester.attach(attesterAddress);

  await updateDeploymentsFile("GitcoinAttester", getAbi(GitcoinAttesterUpdate));

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
