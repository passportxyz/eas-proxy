import hre, { ethers, upgrades } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  updateDeploymentsFile,
  getAbi,
  getVerifierAddress,
} from "./lib/utils";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const verifierAddress = getVerifierAddress();

  const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");

  const preparedUpgradeAddress = await upgrades.prepareUpgrade(
    verifierAddress,
    GitcoinVerifier,
    {
      kind: "uups",
    }
  );

  console.log(
    `✅ Deployed Upgraded GitcoinVerifier. ${preparedUpgradeAddress}`
  );

  await updateDeploymentsFile("GitcoinVerifier", getAbi(GitcoinVerifier));

  const gitcoinVerifier = GitcoinVerifier.attach(verifierAddress);

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
