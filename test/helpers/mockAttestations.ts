import { ethers } from "hardhat";
import {
  SchemaEncoder,
  ZERO_BYTES32,
  NO_EXPIRATION,
  SchemaValue,
  Attestation
} from "@ethereum-attestation-service/eas-sdk";

import { v4 as uuidv4 } from "uuid";

export type Stamp = {
  provider: string;
  stampHash: string;
};

export type Score = {
  score: SchemaValue;
  scorer_id: number;
  score_decimals: number;
};

export const easEncodeScore = (score: Score) => {
  const schemaEncoder = new SchemaEncoder(
    "uint256 score,uint32 scorer_id,uint8 score_decimals"
  );
  const encodedData = schemaEncoder.encodeData([
    { name: "score", value: score.score, type: "uint256" },
    { name: "scorer_id", value: score.scorer_id, type: "uint32" },
    { name: "score_decimals", value: score.score_decimals, type: "uint8" }
  ]);
  return encodedData;
};

export const getScoreAttestation = (
  attestion: Pick<Attestation, "attester" | "recipient" | "schema"> & Partial<Attestation>,
  score: Score
): Attestation => {
  const scoreEncodedData = easEncodeScore(score);
  const uid = ethers.keccak256(ethers.toUtf8Bytes(uuidv4()));
  return {
    uid: uid,
    time: NO_EXPIRATION,
    expirationTime: NO_EXPIRATION,
    revocationTime: NO_EXPIRATION,
    refUID: ZERO_BYTES32,
    revocable: true,
    data: scoreEncodedData,
    ...attestion
  };
};

export const easEncodeStamp = (stamp: Stamp) => {
  const schemaEncoder = new SchemaEncoder("bytes32 provider, bytes32 hash");
  let providerValue = ethers.keccak256(ethers.toUtf8Bytes(stamp.provider));

  const encodedData = schemaEncoder.encodeData([
    { name: "provider", value: providerValue, type: "bytes32" },
    { name: "hash", value: providerValue, type: "bytes32" } // TODO decode hash here
  ]);
  return encodedData;
};

export const encodedData = easEncodeStamp({
  provider: "TestProvider",
  stampHash: "234567890"
});

export const encodeEasPassport = (
  providers: number[],
  hashes: string[],
  issuanceDates: number[],
  expirationDates: number[],
  providerMapVersion: number
): string => {
  const attestationSchemaEncoder = new SchemaEncoder(
    "uint256[] providers, bytes32[] hashes, uint64[] issuanceDates, uint64[] expirationDates, uint16 providerMapVersion"
  );

  const encodedData = attestationSchemaEncoder.encodeData([
    { name: "providers", value: providers, type: "uint256[]" },
    { name: "hashes", value: hashes, type: "bytes32[]" },
    { name: "issuanceDates", value: issuanceDates, type: "uint64[]" },
    { name: "expirationDates", value: expirationDates, type: "uint64[]" },
    // This will be used later for decoding provider mapping for scoring and within the resolver contract
    // Currently set to zero but should be updated whenever providerBitMapInfo.json is updated
    { name: "providerMapVersion", value: providerMapVersion, type: "uint16" }
  ]);

  return encodedData;
};

export const attestationRequest = {
  recipient: "0x4A13F4394cF05a52128BdA527664429D5376C67f",
  expirationTime: NO_EXPIRATION,
  revocable: true,
  data: encodedData,
  refUID: ZERO_BYTES32,
  value: 0
};

export const gitcoinVCSchema =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";

export const multiAttestationRequest = {
  schema: gitcoinVCSchema,
  data: [attestationRequest, attestationRequest, attestationRequest]
};
