// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import { Initializable, OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { AttestationRequest, AttestationRequestData, EAS, Attestation, MultiAttestationRequest, IEAS } from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";
import { InvalidEAS } from "@ethereum-attestation-service/eas-contracts/contracts/Common.sol";

import { GitcoinAttester } from "./GitcoinAttester.sol";

/**
 * @title IGitcoinResolver
 * @notice Minimal interface for consuming GitcoinResolver data
 */
interface IGitcoinResolver
{
  function getUserAttestation(address user, bytes32 schema) external view returns (bytes32);

}
