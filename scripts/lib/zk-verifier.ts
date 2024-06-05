// This script deals with deploying the GitcoinVerifier on a given network

import hre, { zkUpgrades } from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";
import { getAbi, updateDeploymentsFile } from "./utils";

export async function deployZkSyncVerifier(
  attesterAddress: string,
  issuerAddress: string
) {
  console.log("deployZkSyncVerifier ... ");
  const zkWallet = Wallet.fromMnemonic(process.env.DEPLOYER_MNEMONIC);
  const deployer = new Deployer(hre, zkWallet);

  const contract = await deployer.loadArtifact("GitcoinVerifier");
  console.log("deployZkSyncVerifier contract ", contract);
  const verifier = await zkUpgrades.deployProxy(
    deployer.zkWallet,
    contract,
    [issuerAddress, attesterAddress],
    {
      initializer: "initialize"
    }
  );

  console.log("deployZkSyncVerifier verifier ", verifier);
  console.log(" waiting ... ");
  const deployment = await verifier.waitForDeployment();

  const verifierAddress = await deployment.getAddress();
  console.log(`✅ Deployed GitcoinVerifier to ${verifierAddress}`);

  await updateDeploymentsFile(
    "GitcoinVerifier",
    getAbi(deployment),
    verifierAddress
  );

  return deployment;
}
