// This script will create 2 'NAME A SCHEMA' attestations for the scorer and stamps
// schemas

import hre from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getResolverAddress,
  getEASAddress,
  getNamingSchema,
  getScoreV2Schema
} from "./lib/utils";
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

assertEnvironment();

export async function main() {
  const resolverAddress = getResolverAddress();
  const easAddress = getEASAddress();
  const namingSchema = "bytes32 schemaId,string name";
  const scoreV2SchemaUID = getScoreV2Schema();
  const namingSchemaUID = getNamingSchema();

  const scoreV2Label = "Human Passport";

  const eas = new EAS(easAddress);
  eas.connect(await hre.ethers.provider.getSigner());

  await confirmContinue({
    contract: "EAS",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    easAddress: easAddress,
    namingSchema: namingSchema,
    scoreV2SchemaUID: scoreV2SchemaUID
  });

  // Initialize SchemaEncoder with the schema string
  const schemaEncoder = new SchemaEncoder(namingSchema);
  const encodedScoreV2Data = schemaEncoder.encodeData([
    { name: "schemaId", value: scoreV2SchemaUID, type: "bytes32" },
    { name: "name", value: scoreV2Label, type: "string" }
  ]);

  const txScoreV2 = await eas.attest({
    schema: namingSchemaUID,
    data: {
      recipient: resolverAddress,
      expirationTime: 0n,
      revocable: true, // Be aware that if your schema is not revocable, this MUST be false
      data: encodedScoreV2Data,
      refUID:
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    }
  });

  const scoreV2AttestationUID = await txScoreV2.wait();
  console.log("✅ New scoreV2 attestation UID:", scoreV2AttestationUID);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
