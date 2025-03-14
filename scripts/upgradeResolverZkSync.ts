import hre from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getResolverAddress
} from "./lib/utils";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinResolver",
    network: hre.network.name,
    chainId: hre.network.config.chainId
  });

  const resolverAddress = getResolverAddress();
  const zkWallet = Wallet.fromMnemonic(`${process.env.DEPLOYER_MNEMONIC}`);
  const deployer = new Deployer(hre, zkWallet);
  const artifact = await deployer.loadArtifact("GitcoinResolver");

  const upgrade = await hre.zkUpgrades.upgradeProxy(
    deployer.zkWallet,
    resolverAddress,
    artifact
  );
  console.log("Upgraded GitcoinResolver at:", { upgrade });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
