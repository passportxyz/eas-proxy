// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import { Initializable, OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { Attestation, IEAS } from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";

import { IGitcoinResolver } from "./IGitcoinResolver.sol";
import { Credential, Score, IGitcoinPassportDecoder } from "./IGitcoinPassportDecoder.sol";

import "hardhat/console.sol";

/**
 * @title GitcoinPassportDecoder
 * @notice This contract is used to create the bit map of stamp providers onchain, which will allow us to score Passports fully onchain
 */

contract GitcoinPassportDecoder is
  IGitcoinPassportDecoder,
  Initializable,
  UUPSUpgradeable,
  OwnableUpgradeable,
  PausableUpgradeable
{
  // The instance of the EAS contract.
  IEAS public eas;

  // Mapping of the current version to provider arrays
  mapping(uint32 => string[]) public providerVersions;

  // Mapping of previously stored providers
  mapping(uint32 => mapping(string => uint256)) public savedProviders;

  // Current version number
  uint32 public currentVersion;

  // Instance of the GitcoinResolver contract
  IGitcoinResolver public gitcoinResolver;

  // Passport attestation schema UID
  bytes32 public passportSchemaUID;

  // Score attestation schema UID
  bytes32 public scoreSchemaUID;

  /// A provider with the same name already exists
  /// @param provider the name of the duplicate provider
  error ProviderAlreadyExists(string provider);

  /// TODO: check the usage of this
  error ZeroValue();

  /// An attestation for the specified ETH address does not exist within the GitcoinResolver
  error AttestationNotFound();

  /// An attestation was found but it is expired
  /// @param expirationTime the expiration time of the attestation
  error AttestationExpired(uint64 expirationTime);

  // Events
  event EASSet(address easAddress);
  event ResolverSet(address resolverAddress);
  event SchemaSet(bytes32 schemaUID);
  event ProvidersAdded(string[] providers);
  event NewVersionCreated();

  function initialize() public initializer {
    __Ownable_init();
    __Pausable_init();
  }

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  function _authorizeUpgrade(address) internal override onlyOwner {}

  /**
   * @dev Gets the EAS contract.
   */
  function getEASAddress() public view returns (IEAS) {
    return eas;
  }

  /**
   * @dev Gets providers by version.
   */
  function getProviders(uint32 version) public view returns (string[] memory) {
    return providerVersions[version];
  }

  /**
   * @dev Sets the address of the EAS contract.
   * @param _easContractAddress The address of the EAS contract.
   */
  function setEASAddress(address _easContractAddress) external onlyOwner {
    if (_easContractAddress == address(0)) {
      revert ZeroValue();
    }
    eas = IEAS(_easContractAddress);
    emit EASSet(_easContractAddress);
  }

  /**
   * @dev Sets the GitcoinResolver contract.
   * @param _gitcoinResolver The address of the GitcoinResolver contract.
   */
  function setGitcoinResolver(address _gitcoinResolver) external onlyOwner {
    if (_gitcoinResolver == address(0)) {
      revert ZeroValue();
    }
    gitcoinResolver = IGitcoinResolver(_gitcoinResolver);
    emit ResolverSet(_gitcoinResolver);
  }

  /**
   * @dev Sets the schemaUID for the Passport Attestation.
   * @param _schemaUID The UID of the schema used to make the user's passport attestation
   */
  function setPassportSchemaUID(bytes32 _schemaUID) public onlyOwner {
    // TODO: shall we prevent setting a zero address?
    if (_schemaUID == bytes32(0)) {
      revert ZeroValue();
    }
    passportSchemaUID = _schemaUID;
    emit SchemaSet(_schemaUID);
  }

  /**
   * @dev Sets the schemaUID for the Score Attestation.
   * @param _schemaUID The UID of the schema used to make the user's score attestation
   */
  function setScoreSchemaUID(bytes32 _schemaUID) public onlyOwner {
    if (_schemaUID == bytes32(0)) {
      revert ZeroValue();
    }
    scoreSchemaUID = _schemaUID;
    emit SchemaSet(_schemaUID);
  }

  /**
   * @dev Adds a new provider to the end of the providerVersions mapping
   * @param providers provider name
   */
  function addProviders(string[] memory providers) external onlyOwner {
    for (uint256 i = 0; i < providers.length; ) {
      if (bytes(providers[i]).length == 0) {
        revert ZeroValue();
      }

      if (savedProviders[currentVersion][providers[i]] == 1) {
        revert ProviderAlreadyExists(providers[i]);
      }

      providerVersions[currentVersion].push(providers[i]);
      savedProviders[currentVersion][providers[i]] = 1;

      unchecked {
        ++i;
      }
    }
    emit ProvidersAdded(providers);
  }

  /**
   * @dev Creates a new provider.
   * @param providers Array of provider names
   */
  function createNewVersion(string[] memory providers) external onlyOwner {
    for (uint256 i = 0; i < providers.length; ) {
      if (bytes(providers[i]).length == 0) {
        revert ZeroValue();
      }

      unchecked {
        ++i;
      }
    }
    currentVersion++;
    providerVersions[currentVersion] = providers;
    emit NewVersionCreated();
  }

  /**
   * Return an attestation for a given UID
   * @param attestationUID The UID of the attestation
   * TODO: do we really need this helper?
   */
  function getAttestation(
    bytes32 attestationUID
  ) public view returns (Attestation memory) {
    Attestation memory attestation = eas.getAttestation(attestationUID);
    return attestation;
  }

  /**
   * @dev Retrieves the user's Passport attestation via the GitcoinResolver and IEAS and decodes the bits in the provider map to output a readable Passport
   * @param userAddress User's address
   */
  function getPassport(
    address userAddress
  ) external view returns (Credential[] memory) {
    // Get the attestation UID from the user's attestations
    bytes32 attestationUID = gitcoinResolver.getUserAttestation(
      userAddress,
      passportSchemaUID
    );

    // Check if the attestation UID exists within the GitcoinResolver. When an attestation is revoked that attestation UID is set to 0.
    if (attestationUID == 0) {
      revert AttestationNotFound();
    }

    // Get the attestation from the user's attestation UID
    Attestation memory attestation = getAttestation(attestationUID);

    // Check for expiration time
    if (
      attestation.expirationTime > 0 &&
      attestation.expirationTime <= block.timestamp
    ) {
      revert AttestationExpired(attestation.expirationTime);
    }
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

    uint256 hashLength = uint256(hashes.length);
    uint256 expirationLength = uint256(expirationDates.length);

    // Check to make sure that the lengths of the hashes, issuanceDates, and expirationDates match, otherwise end the function call
    assert(
      hashLength == issuanceDates.length && hashLength == expirationLength
    );

    // Set the in-memory passport array to be returned to equal the length of the hashes array
    Credential[] memory passportMemoryArray = new Credential[](hashLength);

    // Now we iterate over the providers array and check each bit that is set
    // If a bit is set
    // we set the hash, issuanceDate, expirationDate, and provider to a Credential struct
    // then we push that struct to the passport storage array and populate the passportMemoryArray
    for (uint256 i = 0; i < providers.length; ) {
      bit = 1;

      // Check to make sure that the hashIndex is less than the length of the expirationDates array, and if not, exit the loop
      if (hashIndex >= expirationLength) {
        break;
      }

      uint256 provider = uint256(providers[i]);

      for (uint256 j = 0; j < 256; ) {
        // Check to make sure that the hashIndex is less than the length of the expirationDates array, and if not, exit the loop
        if (hashIndex >= expirationLength) {
          break;
        }

        uint256 mappedProvidersIndex = i * 256 + j;

        if (mappedProvidersIndex > mappedProviders.length) {
          break;
        }

        // Check that the provider bit is set
        // The provider bit is set --> set the provider, hash, issuance date, and expiration date to the struct
        if (provider & bit > 0) {
          Credential memory credential;
          // Set provider to the credential struct from the mappedProviders mapping
          credential.provider = mappedProviders[mappedProvidersIndex];
          // Set the hash to the credential struct from the hashes array
          credential.hash = hashes[hashIndex];
          // Set the issuanceDate of the credential struct to the item at the current index of the issuanceDates array
          credential.issuanceDate = issuanceDates[hashIndex];
          // Set the expirationDate of the credential struct to the item at the current index of the expirationDates array
          credential.expirationDate = expirationDates[hashIndex];

          // Set the hashIndex with the finished credential struct
          passportMemoryArray[hashIndex] = credential;

          hashIndex += 1;
        }

        unchecked {
          bit <<= 1;
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

  /**
   * @dev Retrieves the user's Score attestation via the GitcoinResolver and returns it
   * @param userAddress User's address
   */
  function getScore(address userAddress) public view returns (Score memory) {
    // Get the attestation UID from the user's attestations
    bytes32 attestationUID = gitcoinResolver.getUserAttestation(
      userAddress,
      scoreSchemaUID
    );

    // Check if the attestation UID exists within the GitcoinResolver. When an attestation is revoked that attestation UID is set to 0.
    if (attestationUID == 0) {
      revert AttestationNotFound();
    }

    // Get the attestation from the user's attestation UID
    Attestation memory attestation = getAttestation(attestationUID);

    // Check for expiration time
    if (
      attestation.expirationTime > 0 &&
      attestation.expirationTime <= block.timestamp
    ) {
      revert AttestationExpired(attestation.expirationTime);
    }

    // Set up the variables to assign the attestion data output to
    Score memory score;

    // Decode the attestion output
    (score.score, score.scorerID, score.decimals) = abi.decode(
      attestation.data,
      (uint256, uint256, uint256)
    );

    // Return the score attestation
    return score;
  }
}
