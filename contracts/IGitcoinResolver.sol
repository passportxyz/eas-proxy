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
    uint64 time; // For checking the age of the stamp, without loading the attestation
    uint64 expirationTime; // This makes sense because we want to make sure the stamp is not expired, and also do not want to load the attestation
  }

  // @dev Stamp used in encoding of V2 scores
  struct Stamp {
    string provider;
    uint32 score;
  }

  /// @param user The ETH address of the recipient
  /// @param schema THE UID of the chema
  /// @return The attestation UID or 0x0 if not found
  /// @dev Returns the latest user attestation for a given schema
  /// @dev Not supported for community-specific attestations
  function getUserAttestation(
    address user,
    bytes32 schema
  ) external view returns (bytes32);

  /// @notice Get the cached score for a user in a the default community
  /// @param user The ETH address of the recipient
  /// @return The `CachedScore` for the given ETH address.
  /// @dev A non-zero value in the `issuanceDate` indicates that a valid score has been retreived.
  function getCachedScore(
    address user
  ) external view returns (CachedScore memory);

  /// @notice Get the cached score for a user in a specific community
  /// @param communityId The ID of the community
  /// @param user The ETH address of the recipient
  /// @return The `CachedScore` for the given ETH address.
  /// @dev A non-zero value in the `issuanceDate` indicates that a valid score has been retreived.
  function getCachedScore(
    uint32 communityId,
    address user
  ) external view returns (CachedScore memory);
}
