// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

// Passport credential struct
struct Credential {
  string provider;
  bytes32 hash;
  uint64 issuanceDate;
  uint64 expirationDate;
}

/**
 * @title IGitcoinPassportDecoder
 * @notice Minimal interface for consuming GitcoinPassportDecoder data
 */
interface IGitcoinPassportDecoder {
  function getPassport(
    address userAddress
  ) external returns (Credential[] memory);
}
