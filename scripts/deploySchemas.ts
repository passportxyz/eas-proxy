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
  const scoreSchema = "uint256 score,uint32 scorer_id,uint8 score_decimals";
  const scoreV2Schema =
    "bool passing_score, uint8 score_decimals, uint128 scorer_id, uint32 score, uint32 threshold, uint48 reserved, tuple(string provider, uint32 score)[] stamps";

  const passportSchema =
    "uint256[] providers,bytes32[] hashes,uint64[] issuanceDates,uint64[] expirationDates,uint16 providerMapVersion";
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
    scoreSchema: scoreSchema,
    passportSchema: passportSchema,
    revocable: revocable,
    deployerAddress: await deployer.getAddress()
  });

  const txScoreSchema = await schemaRegistry.register(
    scoreSchema,
    resolverAddress,
    revocable
  );
  const txScoreSchemaReceipt = await txScoreSchema.wait();
  const scoreSchemaEvent = txScoreSchemaReceipt.logs.filter((log: any) => {
    return log.fragment.name == "Registered";
  });
  const scoreSchemaUID = scoreSchemaEvent[0].args[0];

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

  const txPassportSchema = await schemaRegistry.register(
    passportSchema,
    resolverAddress,
    revocable
  );
  const txPassportSchemaReceipt = await txPassportSchema.wait();

  const passportSchemaEvent = txPassportSchemaReceipt.logs.filter(
    (log: any) => {
      return log.fragment.name == "Registered";
    }
  );
  const passportSchemaUID = passportSchemaEvent[0].args[0];

  addChainInfoToFile(INFO_FILE, getHexChainId(), (thisChainExistingInfo) => ({
    ...thisChainExistingInfo,
    easSchemas: {
      passport: {
        uid: passportSchemaUID
      },
      score: {
        uid: scoreSchemaUID
      },
      scoreV2: {
        uid: scoreV2SchemaUID
      }
    }
  }));

  console.log(`✅ Deployed passport schema ${passportSchemaUID}`);
  console.log(`✅ Deployed score schema ${scoreSchemaUID}`);
  console.log(`✅ Deployed scoreV2 schema ${scoreV2SchemaUID}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
