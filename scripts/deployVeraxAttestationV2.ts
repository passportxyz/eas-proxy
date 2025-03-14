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
  getDecoderAddress
} from "./lib/utils";
import { abiSchemaRegistry } from "./veraxSchemaRegistryAbi";
import { TransactionRequest } from "ethers";

assertEnvironment();

export async function main() {
  const scoreV2Schema =
    "bool passing_score, uint8 score_decimals, uint128 scorer_id, uint32 score, uint32 threshold, tuple(string provider, uint256 score)[] stamps";

  const attestationRegistries: Record<number, string> = {
    59141: "0x90b8542d7288a83EC887229A7C727989C3b56209",
    59144: "0x0f95dCec4c7a93F2637eb13b655F2223ea036B59"
  };
  const lineaSepoliaVeraxRegistryAddress =
    attestationRegistries[hre.network.config.chainId || 0];
  // "0x90b8542d7288a83EC887229A7C727989C3b56209";
  // const lineaSepoliaVeraxRegistryAddress =
  //   "0x0f95dCec4c7a93F2637eb13b655F2223ea036B59";
  const deployer = await hre.ethers.provider.getSigner();

  const veraxSchemaRegistry = new ethers.Contract(
    ethers.getAddress(lineaSepoliaVeraxRegistryAddress),
    abiSchemaRegistry,
    deployer
  );

  const name = "Human Passport";
  const description = "Human Passport score & stamps";
  const context = " ";

  await confirmContinue({
    action: "Deploying Score V2 Schema",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    lineaSepoliaVeraxRegistryAddress,
    name,
    description,
    context,
    scoreV2Schema,
    deployerAddress: await deployer.getAddress()
  });

  const txScoreV2Schema = await veraxSchemaRegistry.createSchema(
    name,
    description,
    context,
    scoreV2Schema
  );

  console.log({
    txScoreV2Schema
  });

  // const createSchemaData = veraxSchemaRegistry.interface.encodeFunctionData(
  //   "createSchema",
  //   [name, description, context, scoreV2Schema]
  // );

  // console.log({ createSchemaData });
  // const nonce = 3;

  // const txn: TransactionRequest = {
  //   nonce,
  //   gasPrice: 10000000,
  //   gasLimit: 100000000,
  //   to: deployer.address,
  //   value: 0,
  //   // data: createSchemaData,
  //   data: null,
  //   chainId: hre.network.config.chainId //Change this chain Id, I am using Ganache
  // };
  // const sentTxnResponse = await deployer.sendTransaction(txn);

  // const txScoreV2SchemaReceipt = await txScoreV2Schema.wait();
  // const scoreV2SchemaEvent = txScoreV2SchemaReceipt.logs.filter((log: any) => {
  //   return log.fragment.name == "SchemaCreated";
  // });
  // const scoreV2SchemaUID = scoreV2SchemaEvent[0].args[0];

  // console.log(`✅ Deployed scoreV2 schema ${scoreV2SchemaUID}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
