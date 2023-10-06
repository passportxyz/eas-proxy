// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

struct AttestationPayload {
  bytes32 schemaId; // The identifier of the schema this attestation adheres to.
  uint64 expirationDate; // The expiration date of the attestation.
  bytes subject; // The ID of the attestee, EVM address, DID, URL etc.
  bytes attestationData; // The attestation data.
}

struct Attestation {
  bytes32 attestationId; // The unique identifier of the attestation.
  bytes32 schemaId; // The identifier of the schema this attestation adheres to.
  bytes32 replacedBy; // Whether the attestation was replaced by a new one.
  address attester; // The address issuing the attestation to the subject.
  address portal; // The id of the portal that created the attestation.
  uint64 attestedDate; // The date the attestation is issued.
  uint64 expirationDate; // The expiration date of the attestation.
  uint64 revocationDate; // The date when the attestation was revoked.
  uint16 version; // Version of the registry when the attestation was created.
  bool revoked; // Whether the attestation is revoked or not.
  bytes subject; // The ID of the attestee, EVM address, DID, URL etc.
  bytes attestationData; // The attestation data.
}


interface IAttestationRegistry {

  function bulkAttest(AttestationPayload[] calldata attestationsPayloads, address attester) external; 

  function getAttestation(bytes32 attestationId) external view returns (Attestation memory); 

  function getAttestationIdCounter() external view returns (uint32); 
}
