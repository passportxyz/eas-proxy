// This script deals with deploying the GitcoinVerifier on a given network

import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getEASSchemaRegistryAddress,
  getResolverAddress,
  addChainInfoToFile,
  INFO_FILE,
  getHexChainId
} from "./lib/utils";
import { SCHEMA_REGISTRY_ABI } from "../test/abi/SCHEMA_REGISTRY_ABI";

assertEnvironment();

export async function main() {
  const resolverAddress = getResolverAddress();
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
    action: "Deploying schemas",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    registryAddress: schemaRegistryContractAddress,
    resolverAddress: resolverAddress,
    revocable: revocable,
    deployerAddress: await deployer.getAddress()
  });

  const txScoreV2Schema = await schemaRegistry.register(
    scoreV2Schema,
    resolverAddress,
    revocable
  );
  const txScoreV2SchemaReceipt = await txScoreV2Schema.wait();
  const scoreV2SchemaEvent = txScoreV2SchemaReceipt.logs.filter((log: any) => {
    return log.fragment.name == "Registered";
  });
  const scoreV2SchemaUID = scoreV2SchemaEvent[0].args[0];

  addChainInfoToFile(INFO_FILE, getHexChainId(), (thisChainExistingInfo) => ({
    ...thisChainExistingInfo,
    easSchemas: {
      ...thisChainExistingInfo.easSchemas,
      scoreV2: {
        uid: scoreV2SchemaUID
      }
    }
  }));

  console.log(`✅ Deployed scoreV2 schema ${scoreV2SchemaUID}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
