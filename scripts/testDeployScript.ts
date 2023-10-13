import hre, { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import { confirmContinue, assertEnvironment } from "./lib/utils";
import { GitcoinAttester__factory, GitcoinResolver__factory, GitcoinPassportDecoder__factory } from "../typechain-types";

assertEnvironment();
dotenv.config();

const easAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
let deployedAttesterAddress: string, deployedResolverAddress: string, deployedPassportDecoderAddress: string;

export async function deployAttester() {
  // Instantiate a new provider using the RPC endpoint url
  const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL ?? "");
  // Instantiate a new wallet using either the private key or the provider
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY ?? "", provider);

  console.log(`Using address - attester: ${wallet.address}`);

  const GitcoinAttester = new GitcoinAttester__factory(wallet);
  
  const attester = await upgrades.deployProxy(GitcoinAttester, {
    kind: "uups",
  });

  const deployment = await attester.waitForDeployment();
  deployedAttesterAddress = await deployment.getAddress();

  console.log(`✅ Deployed GitcoinAttester. ${deployedAttesterAddress}`);

  await deployment.setEASAddress(easAddress);
  console.log(`✅ Set EAS address ${easAddress} on GitcoinAttester.`);

  return deployment;
}

export async function deployResolver() {
  // Instantiate a new provider using the RPC endpoint url
  const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL ?? "");
  // Instantiate a new wallet using either the private key or the provider
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY ?? "", provider);

  console.log(`Using address - resolver: ${wallet.address}`);

  const GitcoinResolver = new GitcoinResolver__factory(wallet);
  const resolver = await upgrades.deployProxy(
    GitcoinResolver, 
    [easAddress, deployedAttesterAddress],
    {
      initializer: "initialize",
      kind: "uups",
    });

  const deployment = await resolver.waitForDeployment();
  deployedResolverAddress = await deployment.getAddress();

  console.log(`✅ Deployed GitcoinResolver. ${deployedResolverAddress}`);

  return deployment;
}

setTimeout(async () => {
  await deployAttester();
}, 5000);

setTimeout(async () => {
  await deployResolver();
}, 40000);

async function main() {
  await confirmContinue({
    contract: "GitcoinPassportDecoder",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  setTimeout(async () => {

    // Instantiate a new provider using the RPC endpoint url
    const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL ?? "");
    // Instantiate a new wallet using either the private key or the provider
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY ?? "", provider);

    console.log(`Using address ${wallet.address}`);

    // Instantiate a new contract factory using the wallet
    const GitcoinPassportDecoder = new GitcoinPassportDecoder__factory(wallet);

    const passportDecoder = await upgrades.deployProxy(
      GitcoinPassportDecoder, 
      [deployedResolverAddress],
      {
        initializer: "initialize",
        kind: "uups",
      });

    // Wait for the deployment
    await passportDecoder.waitForDeployment();
  deployedPassportDecoderAddress = await passportDecoder.getAddress();

    console.log(`GitcoinPassportDecoder deployed at address ${deployedPassportDecoderAddress}`);
  }, 70000);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});