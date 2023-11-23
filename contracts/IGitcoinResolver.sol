// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

/**
 * @title IGitcoinResolver
 * @notice Minimal interface for consuming GitcoinResolver data
 */
interface IGitcoinResolver {
  // Cached data structure
  // Stores a score in a 32 byte data structure for efficient access when reading
  struct CachedScore {
    uint32 score; // compacted uint value 4 decimal places
    uint64 issuanceDate; // For checking the age of the stamp, without loading the attestation
    uint64 expirationDate; // This makes sense because we want to make sure the stamp is not expired, and also do not want to load the attestation
    uint32 scorerId; // would we need this ???
  }

  function getUserAttestation(
    address user,
    bytes32 schema
  ) external view returns (bytes32);

  function getCachedScore(
    address user
  ) external view returns (CachedScore memory);
}
