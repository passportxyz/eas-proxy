import hre, { ethers, upgrades } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  updateDeploymentsFile,
  getAbi,
  getPassportDecoderAddress,
} from "./lib/utils";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinPassportDecoder",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const passportDecoderAddress = getPassportDecoderAddress();

  const GitcoinPassportDecoder = await ethers.getContractFactory(
    "GitcoinPassportDecoder"
  );

  const preparedUpgradeAddress = await upgrades.prepareUpgrade(
    passportDecoderAddress,
    GitcoinPassportDecoder,
    {
      kind: "uups",
      redeployImplementation: "always",
    }
  );

  console.log(
    `✅ Deployed Upgraded GitcoinPassportDecoder. ${preparedUpgradeAddress}`
  );

  await updateDeploymentsFile("GitcoinPassportDecoder", getAbi(GitcoinPassportDecoder));

  const gitcoinPassportDecoder = GitcoinPassportDecoder.attach(passportDecoderAddress);

  const upgradeData = gitcoinPassportDecoder.interface.encodeFunctionData(
    "upgradeTo",
    [preparedUpgradeAddress]
  );

  console.log({ upgradeData });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
