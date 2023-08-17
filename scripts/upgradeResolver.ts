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
    contract: "GitcoinResolverUpdate",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const resolverAddress = getResolverAddress();

  const GitcoinResolverUpdate = await ethers.getContractFactory(
    "GitcoinResolverUpdate"
  );

  const preparedUpgradeAddress = await upgrades.prepareUpgrade(
    resolverAddress,
    GitcoinResolverUpdate,
    {
      kind: "uups",
      redeployImplementation: "always",
    }
  );

  console.log(
    `✅ Deployed Upgraded GitcoinResolverUpdate. ${preparedUpgradeAddress}`
  );

  const GitcoinResolver = await ethers.getContractFactory("GitcoinResolver");
  const gitcoinResolver = GitcoinResolver.attach(resolverAddress);

  await updateDeploymentsFile("GitcoinResolver", getAbi(GitcoinResolverUpdate));

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
