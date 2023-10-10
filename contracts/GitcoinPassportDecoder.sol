// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import { Initializable, OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { GitcoinResolver } from "./GitcoinResolver.sol";

/**
 * @title GitcoinPassportDecoder
 * @notice This contract is used to create the bit map of stamp providers onchain, which will allow us to score Passports fully onchain
 */

contract GitcoinPassportDecoder is 
  Initializable,
  UUPSUpgradeable,
  OwnableUpgradeable,
  PausableUpgradeable
{
  mapping(uint32 => string[]) public providers;

  uint32 public version;

  address public gitcoinResolverAddress;

  function initialize(address _gitcoinResolverAddress) public initializer {
    __Ownable_init();
    __Pausable_init();

    gitcoinResolverAddress = _gitcoinResolverAddress;
  }

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  function _authorizeUpgrade(address) internal override onlyOwner {}

  /**
   * @dev Adds a new provider to the end of the providers mapping
   * @param provider Name of individual provider
   */
  function addProvider(string memory provider) external {
    providers[version].push(provider);
  }

  /**
   * @dev Creates a new provider.
   * @param providerNames Array of provider names
   */
  function createNewVersion(string[] memory providerNames) external {
    version++;
    providers[version] = providerNames;
  }

  /**
   * @dev Retrieves the user's Passport via the GitcoinResolver and decodes the bits in the provider map to output a readable Passport
   * @param userAddress User's address
   * @param schemaUID The UID of the schema used to make the user's attestation
   */
  // getPassport(address): Calls GitcoinResolver to get the passport, then uses the provider mapping to decode the bits in the provider bitmap. This function can handle any bitmap version. The version is stored in the attestation, and the contract has all the data for historical bitmap versions. This should also demux the dates and hashes, so that the user gets back a normal looking passport object.
  function getPassport(address userAddress, bytes32 schemaUID) public view returns (bytes32) {
    GitcoinResolver resolver = GitcoinResolver(gitcoinResolverAddress);

    bytes32 attestationUID = resolver.userAttestations(userAddress, schemaUID);

    // TODO: decode passport

  }
}