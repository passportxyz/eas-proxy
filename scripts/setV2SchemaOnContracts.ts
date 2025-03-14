// This script is for deploying the new human passport schema on an already
// deployed attestation system. If deploying on a new chain, these steps
// are done in other scripts

import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getEASSchemaRegistryAddress,
  getResolverAddress,
  addChainInfoToFile,
  INFO_FILE,
  getHexChainId,
  getDecoderAddress,
  getScoreV2Schema
} from "./lib/utils";
import { SCHEMA_REGISTRY_ABI } from "../test/abi/SCHEMA_REGISTRY_ABI";

assertEnvironment();

export async function main() {
  const resolverAddress = getResolverAddress();
  const decoderAddress = getDecoderAddress();
  const scoreV2Schema =
    "bool passing_score, uint8 score_decimals, uint128 scorer_id, uint32 score, uint32 threshold, tuple(string provider, uint256 score)[] stamps";

  const revocable = true;
  const schemaRegistryContractAddress = getEASSchemaRegistryAddress();

  const deployer = await hre.ethers.provider.getSigner();

  const schemaRegistry = new ethers.Contract(
    ethers.getAddress(schemaRegistryContractAddress),
    SCHEMA_REGISTRY_ABI,
    deployer
  );

  await confirmContinue({
    action: "Set V2 schema ID in contracts: GitcoinResolver, GitcoinPassportDecoder",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    registryAddress: schemaRegistryContractAddress,
    resolverAddress,
    decoderAddress,
    revocable,
    deployerAddress: await deployer.getAddress()
  });

  const scoreV2SchemaUID = getScoreV2Schema();

  const Resolver = await ethers.getContractFactory("GitcoinResolver");
  const resolver = Resolver.attach(resolverAddress);

  const Decoder = await ethers.getContractFactory("GitcoinPassportDecoder");
  const decoder = Decoder.attach(decoderAddress);

  await (await resolver.setScoreV2Schema(scoreV2SchemaUID)).wait();

  console.log(
    `✅ Set scoreV2 schema ${scoreV2SchemaUID} on resolver ${resolverAddress}`
  );

  await (await decoder.setScoreV2SchemaUID(scoreV2SchemaUID)).wait();

  console.log(
    `✅ Set scoreV2 schema ${scoreV2SchemaUID} on decoder ${decoderAddress}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
