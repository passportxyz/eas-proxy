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
  const passportSchema =
    "uint256[] providers,bytes32[] hashes,uint64[] issuanceDates,uint64[] expirationDates,uint16 providerMapVersion";
  const revocable = true;
  const schemaRegistryContractAddress = getEASSchemaRegistryAddress();

  const schemaRegistry = new ethers.Contract(
    ethers.getAddress(schemaRegistryContractAddress),
    SCHEMA_REGISTRY_ABI,
    await hre.ethers.provider.getSigner()
  );

  await confirmContinue({
    contract: "GitcoinVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    registryAddress: schemaRegistryContractAddress,
    resolverAddress: resolverAddress,
    scoreSchema: scoreSchema,
    passportSchema: passportSchema,
    revocable: revocable,
    deplyerAddress: await (await hre.ethers.provider.getSigner()).getAddress()
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
      }
    }
  }));

  console.log(`✅ Deployed passport schema ${passportSchemaUID}`);
  console.log(`✅ Deployed score schema ${scoreSchemaUID}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
