import hre, { ethers, upgrades } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  updateDeploymentsFile,
  getAbi,
  getResolverAddress,
} from "./lib/utils";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinResolver",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const resolverAddress = getResolverAddress();

  const GitcoinResolver = await ethers.getContractFactory("GitcoinResolver");

  const preparedUpgradeAddress = await upgrades.prepareUpgrade(
    resolverAddress,
    GitcoinResolver,
    {
      kind: "uups",
    }
  );

  console.log(
    `✅ Deployed Upgraded GitcoinResolver. ${preparedUpgradeAddress}`
  );

  const gitcoinResolver = GitcoinResolver.attach(resolverAddress);

  await updateDeploymentsFile("GitcoinResolver", getAbi(GitcoinResolver));

  // Encode upgrade transaction
  const upgradeData = gitcoinResolver.interface.encodeFunctionData(
    "upgradeTo",
    [preparedUpgradeAddress]
  );
  console.log(`Upgrade transaction data: ${upgradeData}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
