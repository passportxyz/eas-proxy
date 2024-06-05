// This script deals with deploying the GitcoinVerifier on a given network

import hre, { zkUpgrades } from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";
import { getAbi, updateDeploymentsFile } from "./utils";

export async function deployZkSyncResolver(
  attesterAddress: string,
  easAddress: string
) {
  const zkWallet = Wallet.fromMnemonic(process.env.DEPLOYER_MNEMONIC);
  const deployer = new Deployer(hre, zkWallet);

  const contract = await deployer.loadArtifact("GitcoinResolver");
  const resolver = await zkUpgrades.deployProxy(
    deployer.zkWallet,
    contract,
    [easAddress, attesterAddress],
    {
      initializer: "initialize"
    }
  );

  const deployment = await resolver.waitForDeployment();

  const resolverAddress = await deployment.getAddress();
  console.log(`✅ Deployed GitcoinResolver to ${resolverAddress}`);

  await updateDeploymentsFile(
    "GitcoinResolver",
    getAbi(deployment),
    resolverAddress
  );

  return deployment;
}
