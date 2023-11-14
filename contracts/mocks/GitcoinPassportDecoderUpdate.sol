// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import { Initializable, OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { Attestation, IEAS } from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";

import { GitcoinResolver } from "../GitcoinResolver.sol";

/**
 * @title GitcoinPassportDecoder
 * @notice This contract is used to create the bit map of stamp providers onchain, which will allow us to score Passports fully onchain
 */

contract GitcoinPassportDecoderUpdate is
  Initializable,
  UUPSUpgradeable,
  OwnableUpgradeable,
  PausableUpgradeable
{
  // The instance of the EAS contract.
  IEAS eas;

  // Mapping of version to provider arrays
  mapping(uint32 => string[]) public providerVersions;

  // Version number
  uint32 public version;

  // Address of the GitcoinResolver contract
  address public gitcoinResolverAddress;

  // Passport credential struct
  struct Credential {
    string provider;
    bytes32 hash;
    uint64 issuanceDate;
    uint64 expirationDate;
  }

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

  function finaltest() public pure returns (uint) {
    return 1;
  }

  /**
   * @dev Sets the address of the EAS contract.
   * @param _easContractAddress The address of the EAS contract.
   */
  function setEASAddress(address _easContractAddress) public onlyOwner {
    eas = IEAS(_easContractAddress);
  }

  /**
   * @dev Adds a new provider to the end of the providerVersions mapping
   * @param provider Name of individual provider
   */
  function addProvider(string memory provider) external onlyOwner {
    providerVersions[version].push(provider);
  }

  /**
   * @dev Creates a new provider.
   * @param providerNames Array of provider names
   */
  function createNewVersion(string[] memory providerNames) external onlyOwner {
    version++;
    providerVersions[version] = providerNames;
  }

  function getAttestation(
    bytes32 attestationUID
  ) public view returns (Attestation memory) {
    Attestation memory attestation = eas.getAttestation(attestationUID);
    return attestation;
  }

  /**
   * @dev Retrieves the user's Passport via the GitcoinResolver and decodes the bits in the provider map to output a readable Passport
   * @param userAddress User's address
   * @param schemaUID The UID of the schema used to make the user's attestation
   */
  // getPassport(address): Calls GitcoinResolver to get the passport, then uses the provider mapping to decode the bits in the provider bitmap. This function can handle any bitmap version. The version is stored in the attestation, and the contract has all the data for historical bitmap versions. This should also demux the dates and hashes, so that the user gets back a normal looking passport object.
  function getPassport(
    address userAddress,
    bytes32 schemaUID
  ) public view returns (Credential[] memory) {
    // Set the GitcoinResolver
    GitcoinResolver resolver = GitcoinResolver(gitcoinResolverAddress);

    // Get the attestation UID from the user's attestations
    bytes32 attestationUID = resolver.userAttestations(userAddress, schemaUID);

    // Get the attestation from the user's attestation UID
    Attestation memory attestation = getAttestation(attestationUID);

    // Set up the variables to assign the attestion data output to
    uint256[] memory providers;
    bytes32[] memory hashes;
    uint64[] memory issuanceDates;
    uint64[] memory expirationDates;
    uint16 providerMapVersion;

    // Decode the attestion output
    (
      providers,
      hashes,
      issuanceDates,
      expirationDates,
      providerMapVersion
    ) = abi.decode(
      attestation.data,
      (uint256[], bytes32[], uint64[], uint64[], uint16)
    );

    // Set up the variables to record the bit and the index of the credential hash
    uint256 bit;
    uint256 hashIndex = 0;

    // Set the list of providers to the provider map version
    string[] memory mappedProviders = providerVersions[providerMapVersion];

    // Now we iterate over the providers array and check each bit that is set
    // If a bit is set
    // we set the hash, issuanceDate, expirationDate, and provider to a Credential struct
    // then we push that struct to the passport storage array

    // Set the passport array to be returned to equal the length of the passport saved to storage (for the duration of the function call)
    Credential[] memory passportMemoryArray = new Credential[](hashes.length);

    // Populate the passportMemoryArray
    for (uint256 i = 0; i < providers.length; ) {
      bit = 1;
      uint256 provider = uint256(providers[i]);
      for (uint256 j = 0; j < 256; ) {
        // Check that the provider bit is set
        // The provider bit is set --> set the provider, hash, issuance date, and expiration date to the stuct
        if (provider & bit > 0) {
          Credential memory credential;
          uint256 mappedProvidersIndex = i * 256 + j;

          if (mappedProvidersIndex < mappedProviders.length) {
            credential.provider = mappedProviders[mappedProvidersIndex];
          }

          if (hashIndex < hashes.length) {
            credential.hash = hashes[hashIndex];
          }

          if (hashIndex < issuanceDates.length) {
            credential.issuanceDate = issuanceDates[hashIndex];
          }

          if (hashIndex < expirationDates.length) {
            credential.expirationDate = expirationDates[hashIndex];
          }

          if (hashIndex < hashes.length) {
            passportMemoryArray[hashIndex] = credential;
          }

          hashIndex += 1;
        }
        bit <<= 1;
        unchecked {
          ++j;
        }
      }
      unchecked {
        i += 256;
      }
    }

    // Return the memory passport array
    return passportMemoryArray;
  }
}
