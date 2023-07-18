import hre, { ethers, upgrades } from "hardhat";
import { confirmContinue, assertEnvironment } from "./utils";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinVerifierUpdate",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  if (!process.env.GITCOIN_VERIFIER_ADDRESS) {
    console.error("Please set your GITCOIN_VERIFIER_ADDRESS in a .env file");
    return;
  }

  const GitcoinVerifierUpdate = await ethers.getContractFactory(
    "GitcoinVerifierUpdate"
  );

  const preparedUpgradeAddress = await upgrades.prepareUpgrade(
    process.env.GITCOIN_VERIFIER_ADDRESS || "",
    GitcoinVerifierUpdate,
    {
      kind: "uups",
      redeployImplementation: "always",
    }
  );

  console.log(
    `✅ Deployed Upgraded GitcoinVerifierUpdate. ${preparedUpgradeAddress}`
  );

  const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");

  const gitcoinVerifier = await GitcoinVerifier.attach(
    process.env.GITCOIN_VERIFIER_ADDRESS || ""
  );

  const upgradeData = gitcoinVerifier.interface.encodeFunctionData(
    "upgradeTo",
    [preparedUpgradeAddress]
  );

  console.log({ upgradeData });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
