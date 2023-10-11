// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "hardhat/console.sol";
import { IAttestationRegistry, AttestationPayload, Attestation } from "../external/IAttestationRegistry.sol";

contract VeraxAttestationRegistry is IAttestationRegistry {
  address[] public attesterLog;
  bytes32[] public schemaLog;

  function bulkAttest(
    AttestationPayload[] calldata attestationsPayloads,
    address attester
  ) external {
    console.log("VeraxAttestationRegistry: bulkAttest");
    console.log("attester: %s", attester);
    console.log("attestationsPayloads.length: %s", attestationsPayloads.length);
    attesterLog.push(attester);
    for (uint32 i = 0; i < attestationsPayloads.length; i++) {
      schemaLog.push(attestationsPayloads[i].schemaId);
    }
  }

  function getAttestation(
    bytes32 attestationId
  ) external pure returns (Attestation memory) {
    console.log("VeraxAttestationRegistry: getAttestation");
    console.logBytes32(attestationId);
    Attestation memory fakeAttestation;
    fakeAttestation.attestationId = attestationId;
    return fakeAttestation;
  }

  function getAttestationIdCounter() external pure returns (uint32) {
    console.log("VeraxAttestationRegistry: getAttestationIdCounter");
    return 123;
  }
}
