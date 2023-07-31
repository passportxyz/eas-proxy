import hre, { ethers, upgrades } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  updateDeploymentsFile,
  getAbi,
} from "./utils";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinResolverUpdate",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  if (!process.env.GITCOIN_RESOLVER_ADDRESS) {
    console.error("Please set your GITCOIN_RESOLVER_ADDRESS in a .env file");
    return;
  }

  const GitcoinResolverUpdate = await ethers.getContractFactory(
    "GitcoinResolverUpdate"
  );

  const preparedUpgradeAddress = await upgrades.prepareUpgrade(
    process.env.GITCOIN_RESOLVER_ADDRESS || "",
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
  const gitcoinResolver = await GitcoinResolver.attach(
    process.env.GITCOIN_RESOLVER_ADDRESS || ""
  );

  await updateDeploymentsFile(
    "GitcoinResolver",
    getAbi(GitcoinResolverUpdate),
    hre.network.config.chainId
  );

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
