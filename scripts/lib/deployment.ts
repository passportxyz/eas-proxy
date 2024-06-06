import hre, { ethers, upgrades, zkUpgrades, zksyncEthers } from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Wallet } from "zksync-ethers";
import type { Contract } from "ethers";

async function zkDeploy(
  artifactName: string,
  argsForInitialize: unknown[]
): Promise<Contract> {
  const zkWallet = Wallet.fromMnemonic(`${process.env.DEPLOYER_MNEMONIC}`);
  const deployer = new Deployer(hre, zkWallet);
  const artifact = await deployer.loadArtifact(artifactName);
  const contract = await zkUpgrades.deployProxy(
    deployer.zkWallet,
    artifact,
    argsForInitialize,
    {
      kind: "uups",
      initializer: "initialize"
    }
  );
  return contract;
}

async function deploy(
  artifactName: string,
  argsForInitialize: unknown[]
): Promise<Contract> {
  const contractFactory = await ethers.getContractFactory(artifactName);
  const contract = await upgrades.deployProxy(
    contractFactory,
    argsForInitialize,
    {
      kind: "uups",
      initializer: "initialize"
    }
  );
  return contract;
}

export async function deployContract(
  artifactName: string,
  argsForInitialize: unknown[],
  opts: {} = {}
): Promise<Contract> {
  if (hre.network.zksync) {
    return zkDeploy(artifactName, argsForInitialize);
  } else {
    return deploy(artifactName, argsForInitialize);
  }
}
