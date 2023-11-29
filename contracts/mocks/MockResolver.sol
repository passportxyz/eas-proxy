// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import {Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import {ISchemaResolver} from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";

import {IGitcoinResolver} from "../IGitcoinResolver.sol";

/**
 * @title GitcoinResolver
 * @notice This contract is used to as a resolver contract for EAS schemas, and it will track the last attestation issued for a given recipient.
 */
contract MockResolver is IGitcoinResolver, ISchemaResolver {
  error AccessDenied();
  error InsufficientValue();
  error NotPayable();

  // Mapping of addresses to schemas to an attestation UID
  mapping(address => mapping(bytes32 => bytes32)) public userAttestations;

  // List of addresses allowed to write to this contract
  mapping(address => bool) public allowlist;

  // Mapping of addresses to scores
  mapping(address => CachedScore) private scores;

  // Mapping of active passport score schemas - used when storing scores to state
  mapping(bytes32 => bool) private scoreSchemas;

  /**
   * @dev Returns whether the resolver supports ETH transfers. Required function from the interface ISchemaResolver that we won't be using
   * @inheritdoc ISchemaResolver
   */
  function isPayable() external pure returns (bool) {
    return false;
  }

  /**
   * @dev Processes an attestation and verifies whether it's valid.
   * @param attestation The new attestation.
   * @return Whether the attestation is valid.
   * @inheritdoc ISchemaResolver
   */
  function attest(
    Attestation calldata attestation
  ) external payable returns (bool) {
    return _attest(attestation);
  }

  function _attest(Attestation calldata attestation) internal returns (bool) {
    userAttestations[attestation.recipient][attestation.schema] = attestation
      .uid;

    return true;
  }

  /**
   * @dev Returns the cached score for a given address.
   */
  function getCachedScore(
    address user
  ) external view returns (CachedScore memory) {
    return scores[user];
  }

  /**
   * @dev Processes multiple attestations and verifies whether they are valid.
   * @param attestations The new attestations.
   * @return Whether all the attestations are valid.
   * @inheritdoc ISchemaResolver
   */
  function multiAttest(
    Attestation[] calldata attestations,
    uint256[] calldata
  ) external payable returns (bool) {
    for (uint i = 0; i < attestations.length; ) {
      _attest(attestations[i]);

      unchecked {
        ++i;
      }
    }
    return true;
  }

  /**
   * @dev Processes an attestation revocation and verifies if it can be revoked.
   * @param attestation The existing attestation to be revoked.
   * @return Whether the attestation can be revoked.
   * @inheritdoc ISchemaResolver
   */
  function revoke(
    Attestation calldata attestation
  ) external payable returns (bool) {
    return _revoke(attestation);
  }

  /**
   * @dev Processes revocation of multiple attestation and verifies they can be revoked.
   * @param attestations The existing attestations to be revoked.
   * @return Whether the attestations can be revoked.
   * @inheritdoc ISchemaResolver
   */
  function multiRevoke(
    Attestation[] calldata attestations,
    uint256[] calldata
  ) external payable returns (bool) {
    for (uint i = 0; i < attestations.length; ) {
      _revoke(attestations[i]);

      unchecked {
        ++i;
      }
    }
    return true;
  }

  function _revoke(Attestation calldata attestation) internal returns (bool) {
    userAttestations[attestation.recipient][attestation.schema] = 0;

    return true;
  }

  function getUserAttestation(
    address user,
    bytes32 schema
  ) external view returns (bytes32) {
    return userAttestations[user][schema];
  }
}
