// This script deals with deploying the GitcoinAttester on a given network
import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  transferOwnershipToMultisig,
  getAttesterAddress,
  getVerifierAddress,
  getResolverAddress,
  getPassportDecoderAddress,
} from "./lib/utils";

assertEnvironment();

if (!process.env.PASSPORT_MULTISIG_ADDRESS) {
  console.error("Please set your PASSPORT_MULTISIG_ADDRESS in a .env file");
}

export async function main() {
  await confirmContinue({
    contract: "Transferring Ownership of All Contracts to Multisig",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const GitcoinResolver = await ethers.getContractFactory("GitcoinResolver");
  const resolver = GitcoinResolver.attach(getResolverAddress());

  const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
  const verifier = GitcoinVerifier.attach(getVerifierAddress());

  const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
  const attester = GitcoinAttester.attach(getAttesterAddress());

  const GitcoinPassportDecoder = await ethers.getContractFactory("GitcoinPassportDecoder");
  const passportDecoder = GitcoinPassportDecoder.attach(getPassportDecoderAddress());

  await transferOwnershipToMultisig(resolver);
  await transferOwnershipToMultisig(verifier);
  await transferOwnershipToMultisig(attester);
  await transferOwnershipToMultisig(passportDecoder);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
