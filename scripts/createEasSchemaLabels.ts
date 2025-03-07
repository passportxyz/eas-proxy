// This script will create 2 'NAME A SCHEMA' attestations for the scorer and stamps
// schemas

import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getResolverAddress,
  getEASAddress,
  getScoreSchema,
  getPassportSchema,
  getNamingSchema,
  getScoreV2Schema
} from "./lib/utils";
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

assertEnvironment();

export async function main() {
  const resolverAddress = getResolverAddress();
  const easAddress = getEASAddress();
  const namingSchema = "bytes32 schemaId,string name";
  const scoreSchemaUID = getScoreSchema();
  const scoreV2SchemaUID = getScoreV2Schema();
  const passportSchemaUID = getPassportSchema();
  const namingSchemaUID = getNamingSchema();

  const gitcoinPassportSchemaLabel = "GITCOIN PASSPORT STAMPS V1";
  const gitcoinScoreSchemaLabel = "GITCOIN PASSPORT SCORES V1";
  const scoreV2Label = "Human Passport";

  const eas = new EAS(easAddress);
  eas.connect(await hre.ethers.provider.getSigner());

  await confirmContinue({
    contract: "EAS",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    easAddress: easAddress,
    namingSchema: namingSchema,
    scoreSchemaUID: scoreSchemaUID,
    scoreV2SchemaUID: scoreV2SchemaUID,
    gitcoinScoreSchemaLabel: gitcoinScoreSchemaLabel,
    passportSchemaUID: passportSchemaUID,
    gitcoinPassportSchemaLabel: gitcoinPassportSchemaLabel
  });

  // Initialize SchemaEncoder with the schema string
  const schemaEncoder = new SchemaEncoder(namingSchema);
  const encodedScoreData = schemaEncoder.encodeData([
    { name: "schemaId", value: scoreSchemaUID, type: "bytes32" },
    { name: "name", value: gitcoinScoreSchemaLabel, type: "string" }
  ]);
  const encodedScoreV2Data = schemaEncoder.encodeData([
    { name: "schemaId", value: scoreV2SchemaUID, type: "bytes32" },
    { name: "name", value: scoreV2Label, type: "string" }
  ]);
  const encodedPassportData = schemaEncoder.encodeData([
    { name: "schemaId", value: passportSchemaUID, type: "bytes32" },
    { name: "name", value: gitcoinPassportSchemaLabel, type: "string" }
  ]);

  const txScore = await eas.attest({
    schema: namingSchemaUID,
    data: {
      recipient: resolverAddress,
      expirationTime: 0n,
      revocable: true, // Be aware that if your schema is not revocable, this MUST be false
      data: encodedScoreData,
      refUID:
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    }
  });

  const scoreAttestationUID = await txScore.wait();
  console.log("✅ New score attestation UID:", scoreAttestationUID);

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

  const txPassport = await eas.attest({
    schema: namingSchemaUID,
    data: {
      recipient: resolverAddress, // This value does not really matter
      expirationTime: 0n,
      revocable: true, // Be aware that if your schema is not revocable, this MUST be false
      data: encodedPassportData,
      refUID:
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    }
  });

  const passportAttestationUID = await txPassport.wait();
  console.log("✅ New passport attestation UID:", passportAttestationUID);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
