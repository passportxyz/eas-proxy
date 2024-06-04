// This script deals with deploying the GitcoinAttester on a given network
import hre, { zksyncEthers, zkUpgrades } from "hardhat";
import { updateDeploymentsFile, getAbi, getEASAddress } from "./utils";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";

const ethers = zksyncEthers;
const upgrades = zkUpgrades;
export async function deployAttester() {
  // console.log("zksyncEthers", zksyncEthers);

  const zkWallet = Wallet.fromMnemonic(process.env.DEPLOYER_MNEMONIC);
  const deployer = new Deployer(hre, zkWallet);

  console.log("hre.deployer", hre.network.provider);
  console.log("upgrades", upgrades);

  console.log("... deployAttester");
  const easAddress = getEASAddress();
  console.log("... deployAttester", easAddress);
  // const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
  // console.log("... factory", GitcoinAttester);
  const contract = await deployer.loadArtifact("GitcoinAttester");
  console.log("... deployAttester contract", contract);
  const attester = await upgrades.deployProxy(deployer.zkWallet, contract, [], {
    initializer: "initialize"
  });

  console.log("... waiting");
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
