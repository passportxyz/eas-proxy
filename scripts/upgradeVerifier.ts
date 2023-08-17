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
    contract: "GitcoinVerifierUpdate",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const verifierAddress = getVerifierAddress();

  const GitcoinVerifierUpdate = await ethers.getContractFactory(
    "GitcoinVerifierUpdate"
  );

  const preparedUpgradeAddress = await upgrades.prepareUpgrade(
    verifierAddress,
    GitcoinVerifierUpdate,
    {
      kind: "uups",
      redeployImplementation: "always",
    }
  );

  console.log(
    `✅ Deployed Upgraded GitcoinVerifierUpdate. ${preparedUpgradeAddress}`
  );

  await updateDeploymentsFile("GitcoinVerifier", getAbi(GitcoinVerifierUpdate));

  const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");

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
