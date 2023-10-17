// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

/**
 * @title IGitcoinResolver
 * @notice Minimal interface for consuming GitcoinResolver data
 */
interface IGitcoinResolver {
  function getUserAttestation(
    address user,
    bytes32 schema
  ) external view returns (bytes32);
}
