// This script deals with deploying the GitcoinAttester on a given network
import hre, { zkUpgrades } from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";
import { updateDeploymentsFile, getAbi, getEASAddress } from "./utils";

export async function deployZkSyncAttester() {
  const zkWallet = Wallet.fromMnemonic(process.env.DEPLOYER_MNEMONIC);
  const deployer = new Deployer(hre, zkWallet);

  const easAddress = getEASAddress();
  const contract = await deployer.loadArtifact("GitcoinAttester");
  const attester = await zkUpgrades.deployProxy(
    deployer.zkWallet,
    contract,
    [],
    {
      initializer: "initialize"
    }
  );

  const deployment = await attester.waitForDeployment();
  const deployedAddress = await deployment.getAddress();

  console.log(`✅ Deployed GitcoinAttester. ${deployedAddress}`);

  await updateDeploymentsFile(
    "GitcoinAttester",
    getAbi(deployment),
    deployedAddress
  );

  await deployment.setEASAddress(easAddress);
  console.log(`✅ Set EAS address ${easAddress} on GitcoinAttester.`);

  return deployment;
}
