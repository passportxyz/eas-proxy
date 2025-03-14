import hre from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getPassportDecoderAddress
} from "./lib/utils";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinPassportDecoder",
    network: hre.network.name,
    chainId: hre.network.config.chainId
  });

  const passportDecoderAddress = getPassportDecoderAddress();
  const zkWallet = Wallet.fromMnemonic(`${process.env.DEPLOYER_MNEMONIC}`);
  const deployer = new Deployer(hre, zkWallet);
  const artifact = await deployer.loadArtifact("GitcoinPassportDecoder");

  const upgrade = await hre.zkUpgrades.upgradeProxy(
    deployer.zkWallet,
    passportDecoderAddress,
    artifact
  );
  console.log("Upgraded GitcoinPassportDecoder at:", { upgrade });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
