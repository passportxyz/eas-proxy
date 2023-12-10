// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import {Initializable, OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Attestation, IEAS} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

import {IGitcoinResolver} from "./IGitcoinResolver.sol";
import {Credential, IGitcoinPassportDecoder} from "./IGitcoinPassportDecoder.sol";

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
  mapping(uint32 => mapping(string => uint256)) public reversedMappingVersions;

  // Current version number
  uint32 public currentVersion;

  // Instance of the GitcoinResolver contract
  IGitcoinResolver public gitcoinResolver;

  // Passport attestation schema UID
  bytes32 public passportSchemaUID;

  // Score attestation schema UID
  bytes32 public scoreSchemaUID;

  // Maximum score age in seconds
  uint64 public maxScoreAge;

  // Minimum score
  uint256 public threshold;

  /// A provider with the same name already exists
  /// @param provider the name of the duplicate provider
  error ProviderAlreadyExists(string provider);

  /// An empty provider string was passed
  error EmptyProvider();

  /// Zero value was passed
  error ZeroValue();

  /// An attestation for the specified ETH address does not exist within the GitcoinResolver
  error AttestationNotFound();

  /// An attestation was found but it is expired
  /// @param expirationTime the expiration time of the attestation
  error AttestationExpired(uint64 expirationTime);

  /// A threshold of zero was passed
  error ZeroThreshold();

  /// A max score age of zero was passed
  error ZeroMaxScoreAge();

  /// Score does not meet the threshold
  error ScoreDoesNotMeetThreshold(uint256 score);

  // Events
  event EASSet(address easAddress);
  event ResolverSet(address resolverAddress);
  event SchemaSet(bytes32 schemaUID);
  event ProvidersAdded(string[] providers);
  event NewVersionCreated();
  event MaxScoreAgeSet(uint256 maxScoreAge);
  event ThresholdSet(uint256 threshold);

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
  // TODO this is getter for EAS. Remove this, eas is public ...
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
  // TODO: rename to setGitcoinResolverAddress ???
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
   * @dev Sets the maximum allowed age of the score
   * @param _maxScoreAge Max age of the score in seconds
   */
  function setMaxScoreAge(uint64 _maxScoreAge) public onlyOwner {
    if (_maxScoreAge == 0) {
      revert ZeroMaxScoreAge();
    }

    maxScoreAge = _maxScoreAge;

    emit MaxScoreAgeSet(maxScoreAge);
  }

  /**
   * @dev Sets the threshold for the minimum score
   * @param _threshold Minimum score allowed, as a 4 digit number
   */
  function setThreshold(uint256 _threshold) public onlyOwner {
    if (_threshold == 0) {
      revert ZeroThreshold();
    }

    threshold = _threshold;

    emit ThresholdSet(threshold);
  }

  /**
   * @dev Adds a new provider to the end of the providerVersions mapping
   * @param providers provider name
   */
  function addProviders(string[] memory providers) external onlyOwner {
    for (uint256 i = 0; i < providers.length; ) {
      if (bytes(providers[i]).length == 0) {
        revert EmptyProvider();
      }

      if (reversedMappingVersions[currentVersion][providers[i]] == 1) {
        revert ProviderAlreadyExists(providers[i]);
      }

      providerVersions[currentVersion].push(providers[i]);
      reversedMappingVersions[currentVersion][providers[i]] = 1;

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
        revert EmptyProvider();
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
   */
  function getAttestation(
    bytes32 attestationUID
  ) public view returns (Attestation memory) {
    Attestation memory attestation = eas.getAttestation(attestationUID);
    return attestation;
  }

  /**
   * @dev Retrieves the user's Passport attestation via the GitcoinResolver and IEAS and decodes the bits in the provider map to output a readable Passport
   * @param user User's address
   */
  function getPassport(
    address user
  ) external view returns (Credential[] memory) {
    // Get the attestation UID from the user's attestations
    bytes32 attestationUID = gitcoinResolver.getUserAttestation(
      user,
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
    uint256 providersBucketsLength = uint256(providers.length);
    uint256 mappedProvidersLength = uint256(mappedProviders.length);

    // Check to make sure that the lengths of the hashes, issuanceDates, and expirationDates match, otherwise end the function call
    assert(
      hashLength == issuanceDates.length && hashLength == expirationDates.length
    );

    // Set the in-memory passport array to be returned to equal the length of the hashes array
    Credential[] memory passportMemoryArray = new Credential[](hashLength);

    // Now we iterate over the providers array and check each bit that is set
    // If a bit is set
    // we set the hash, issuanceDate, expirationDate, and provider to a Credential struct
    // then we push that struct to the passport storage array and populate the passportMemoryArray
    for (uint256 i = 0; i < providersBucketsLength; ) {
      bit = 1;

      uint256 provider = uint256(providers[i]);

      for (uint256 j = 0; j < 256; ) {
        // Check to make sure that the hashIndex is less than the length of the expirationDates array, and if not, exit the loop
        if (hashIndex >= hashLength) {
          break;
        }

        uint256 mappedProvidersIndex = i * 256 + j;

        if (mappedProvidersIndex > mappedProvidersLength) {
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
          credential.time = issuanceDates[hashIndex];
          // Set the expirationDate of the credential struct to the item at the current index of the expirationDates array
          credential.expirationTime = expirationDates[hashIndex];

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
   * This function will check a score attestation for expiration.
   * Even though the score attestation does not have an expiry date, ths function will check
   * that it is not older than `maxScoreAge` seconds since issuance.
   *
   * @param attestation The attestation to check for expiration
   */
  function _isScoreAttestationExpired(
    Attestation memory attestation
  ) internal view returns (bool) {
    if (attestation.expirationTime > 0) {
      return block.timestamp > attestation.expirationTime;
    }

    return block.timestamp > attestation.time + maxScoreAge;
  }

  /**
   * This function will check a cached score for expiration (this is the equivalent
   * of the `_isScoreAttestationExpired` function for cached scores)
   *
   * @param score The attestation to check for expiration
   */
  function _isCachedScoreExpired(
    IGitcoinResolver.CachedScore memory score
  ) internal view returns (bool) {
    if (score.expirationTime > 0) {
      // If the score has an expiration time, check that it is not expired
      return block.timestamp > score.expirationTime;
    }
    return (block.timestamp > score.time + maxScoreAge);
  }

  /**
   * @dev Retrieves the user's Score attestation via the GitcoinResolver and returns it as a 4 digit number
   * @param user The ETH address of the recipient
   */
  function getScore(address user) public view returns (uint256) {
    IGitcoinResolver.CachedScore memory cachedScore = gitcoinResolver
      .getCachedScore(user);

    if (cachedScore.time != 0) {
      // Check for expiration time
      if (_isCachedScoreExpired(cachedScore)) {
        revert AttestationExpired(cachedScore.time);
      }

      // Return the score value
      return cachedScore.score;
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // Fallback: read the score from the attestation if retreiving it from the cache eas not possible
    //////////////////////////////////////////////////////////////////////////////////////////////////
    bytes32 attestationUID = gitcoinResolver.getUserAttestation(
      user,
      scoreSchemaUID
    );

    // Check if the attestation UID exists within the GitcoinResolver. When an attestation is revoked that attestation UID is set to 0.
    if (attestationUID == 0) {
      revert AttestationNotFound();
    }

    // Get the attestation from the user's attestation UID
    Attestation memory attestation = getAttestation(attestationUID);

    // Decode the attestion output
    uint256 score;
    uint8 decimals;
    (score, , decimals) = abi.decode(
      attestation.data,
      (uint256, uint32, uint8)
    );

    // Convert the number to a 4 digit number
    if (decimals > 4) {
      score /= 10 ** (decimals - 4);
    } else if (decimals < 4) {
      score *= 10 ** (4 - decimals);
    }

    // Check if score is older than max age
    if (_isScoreAttestationExpired(attestation)) {
      revert AttestationExpired(attestation.time + maxScoreAge);
    }

    // Return the score value
    return score;
  }

  /**
   * @dev Determines if a user is a human based on their score being above a certain threshold and valid within the max score age
   * @param user The ETH address of the recipient
   */
  function isHuman(address user) public view returns (bool) {
    uint256 score = getScore(user);
    bool isAboveThreshold = score >= threshold;

    if (!isAboveThreshold) {
      revert ScoreDoesNotMeetThreshold(score);
    }

    return isAboveThreshold;
  }
}
