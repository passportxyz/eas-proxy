import hre, { ethers, upgrades } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  updateDeploymentsFile,
  getAbi,
  getPassportDecoderAddress
} from "./lib/utils";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinPassportDecoder - Shape",
    network: hre.network.name,
    chainId: hre.network.config.chainId
  });

  const passportDecoderAddress = getPassportDecoderAddress();

  const GitcoinPassportDecoderShape = await ethers.getContractFactory(
    "GitcoinPassportDecoderShape"
  );

  const preparedUpgradeAddress = await upgrades.prepareUpgrade(
    passportDecoderAddress,
    GitcoinPassportDecoderShape,
    {
      kind: "uups",
      redeployImplementation: "always"
    }
  );

  console.log(
    `✅ Prepared Upgrade for GitcoinPassportDecoder - Shape. ${preparedUpgradeAddress}`
  );

  await updateDeploymentsFile(
    "GitcoinPassportDecoder",
    getAbi(GitcoinPassportDecoderShape)
  );

  const gitcoinPassportDecoder = GitcoinPassportDecoderShape.attach(
    passportDecoderAddress
  );

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
