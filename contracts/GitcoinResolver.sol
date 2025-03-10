// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import {Initializable, OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import {AttestationRequest, AttestationRequestData, EAS, Attestation, MultiAttestationRequest, IEAS} from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import {ISchemaResolver} from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";
import {InvalidEAS} from "@ethereum-attestation-service/eas-contracts/contracts/Common.sol";

import {GitcoinAttester} from "./GitcoinAttester.sol";

import {IGitcoinResolver} from "./IGitcoinResolver.sol";

/**
 * @title GitcoinResolver
 * @notice This contract is used to as a resolver contract for EAS schemas, and it will track the last attestation issued for a given recipient.
 */
contract GitcoinResolver is
  IGitcoinResolver,
  Initializable,
  UUPSUpgradeable,
  OwnableUpgradeable,
  PausableUpgradeable,
  ISchemaResolver
{
  error AccessDenied();
  error InsufficientValue();
  error NotPayable();
  error NotAllowlisted();
  error InvalidAttester();

  event ScoreSchemaSet(bytes32 schema);

  // Mapping of addresses to schemas to an attestation UID
  mapping(address => mapping(bytes32 => bytes32)) public userAttestations;

  // The global EAS contract.
  IEAS public _eas;

  // Gitcoin Attester contract
  GitcoinAttester public _gitcoinAttester;

  // List of addresses allowed to write to this contract
  mapping(address => bool) public allowlist;

  // Mapping of addresses to scores
  mapping(address => CachedScore) public scores;

  bytes32 public scoreSchema;

  uint32 public defaultCommunityId;

  // Mapping of communityId => address => score
  mapping(uint32 => mapping(address => CachedScore)) public communityScores;

  // Mapping of communityId => address => score attestation UID
  mapping(uint32 => mapping(address => bytes32))
    public communityScoreAttestations;

  bytes32 public scoreV2Schema;

  /**
   * @dev Creates a new resolver.
   * @notice Initializer function responsible for setting up the contract's initial state.
   * @param eas The address of the global EAS contract
   * @param gitcoinAttester The address of the Gitcoin Attester contract.
   */
  function initialize(
    IEAS eas,
    GitcoinAttester gitcoinAttester
  ) public initializer {
    __Ownable_init();
    __Pausable_init();

    if (address(eas) == address(0)) {
      revert InvalidEAS();
    }
    _eas = eas;
    _gitcoinAttester = gitcoinAttester;
    allowlist[address(eas)] = true;
  }

  modifier onlyAllowlisted() {
    if (!allowlist[msg.sender]) {
      revert NotAllowlisted();
    }

    _;
  }

  function addToAllowlist(address addr) external onlyOwner {
    allowlist[addr] = true;
  }

  function removeFromAllowlist(address addr) external onlyOwner {
    allowlist[addr] = false;
  }

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  function setDefaultCommunityId(uint32 communityId) external onlyOwner {
    defaultCommunityId = communityId;
  }

  /**
   * @dev Set supported score schemas.
   * @param _schema The score schema uid
   */
  function setScoreSchema(bytes32 _schema) external onlyOwner {
    scoreSchema = _schema;
    emit ScoreSchemaSet(_schema);
  }

  /**
   * @dev Set supported scoreV2 schema
   * @param _schema The score schema uid
   */
  function setScoreV2Schema(bytes32 _schema) external onlyOwner {
    scoreV2Schema = _schema;
    emit ScoreSchemaSet(_schema);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address) internal override onlyOwner {}

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
  ) external payable whenNotPaused onlyAllowlisted returns (bool) {
    return _attest(attestation);
  }

  function _attest(Attestation calldata attestation) internal returns (bool) {
    if (attestation.attester != address(_gitcoinAttester)) {
      revert InvalidAttester();
    }

    if (scoreV2Schema == attestation.schema) {
      _setScoreV2(attestation);
    } else if (scoreSchema == attestation.schema) {
      _setScore(attestation);
    } else {
      userAttestations[attestation.recipient][attestation.schema] = attestation
        .uid;
    }
    return true;
  }

  /**
   * @dev Stores Score data in state.
   * @param attestation The new attestation.
   */
  function _setScore(Attestation calldata attestation) private {
    // Decode the score attestion output
    (uint256 score, uint32 communityId, uint8 digits) = abi.decode(
      attestation.data,
      (uint256, uint32, uint8)
    );

    if (digits > 4) {
      score /= 10 ** (digits - 4);
    } else if (digits < 4) {
      score *= 10 ** (4 - digits);
    }

    CachedScore memory cachedScore = CachedScore(
      uint32(score),
      attestation.time,
      attestation.expirationTime
    );

    if (communityId == defaultCommunityId || defaultCommunityId == 0) {
      scores[attestation.recipient] = cachedScore;
      userAttestations[attestation.recipient][attestation.schema] = attestation
        .uid;
    } else {
      communityScores[communityId][attestation.recipient] = cachedScore;
    }
  }

  /**
   * @dev Stores Score V2 data in state.
   * @param attestation The new attestation.
   */
  function _setScoreV2(Attestation calldata attestation) private {
    // Decode the score attestion output
    (, uint8 scoreDecimals, uint128 rawCommunityId, uint32 score, , ) = abi
      .decode(
        attestation.data,
        (bool, uint8, uint128, uint32, uint32, Stamp[])
      );

    uint32 communityId = uint32(rawCommunityId);

    if (scoreDecimals > 4) {
      score /= uint32(10 ** (scoreDecimals - 4));
    } else if (scoreDecimals < 4) {
      score *= uint32(10 ** (4 - scoreDecimals));
    }

    CachedScore memory cachedScore = CachedScore(
      score,
      attestation.time,
      attestation.expirationTime
    );

    if (communityId == defaultCommunityId || defaultCommunityId == 0) {
      scores[attestation.recipient] = cachedScore;
      userAttestations[attestation.recipient][attestation.schema] = attestation
        .uid;
    } else {
      communityScores[communityId][attestation.recipient] = cachedScore;
      communityScoreAttestations[communityId][
        attestation.recipient
      ] = attestation.uid;
    }
  }

  /**
   * @dev Removes the score data from the state for the specified recipient.
   * @param attestation The attestation to be removed.
   */
  function _removeScore(Attestation calldata attestation) private {
    // Decode the score attestion output
    (, uint32 communityId, ) = abi.decode(
      attestation.data,
      (uint256, uint32, uint8)
    );

    if (communityId == defaultCommunityId || defaultCommunityId == 0) {
      delete scores[attestation.recipient];
      delete userAttestations[attestation.recipient][attestation.schema];
    } else {
      delete communityScores[communityId][attestation.recipient];
    }
  }

  /**
   * @dev Removes the score data from the state for the specified recipient.
   * @param attestation The attestation to be removed.
   */
  function _removeScoreV2(Attestation calldata attestation) private {
    // Decode the score attestion output
    (, , uint128 rawCommunityId, , , ) = abi.decode(
      attestation.data,
      (bool, uint8, uint128, uint32, uint32, Stamp[])
    );

    uint32 communityId = uint32(rawCommunityId);

    if (communityId == defaultCommunityId || defaultCommunityId == 0) {
      delete scores[attestation.recipient];
      delete userAttestations[attestation.recipient][attestation.schema];
    } else {
      delete communityScores[communityId][attestation.recipient];
    }
    delete communityScoreAttestations[communityId][attestation.recipient];
  }

  /// @inheritdoc IGitcoinResolver
  function getCachedScore(
    address user
  ) external view returns (CachedScore memory) {
    return scores[user];
  }

  /// @inheritdoc IGitcoinResolver
  function getCachedScore(
    uint32 communityId,
    address user
  ) external view returns (CachedScore memory) {
    if (communityId == defaultCommunityId || defaultCommunityId == 0) {
      return scores[user];
    } else {
      return communityScores[communityId][user];
    }
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
  ) external payable whenNotPaused onlyAllowlisted returns (bool) {
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
  ) external payable whenNotPaused onlyAllowlisted returns (bool) {
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
  ) external payable whenNotPaused onlyAllowlisted returns (bool) {
    for (uint i = 0; i < attestations.length; ) {
      _revoke(attestations[i]);

      unchecked {
        ++i;
      }
    }
    return true;
  }

  /**
   * @dev Processes an revocation request
   * @param attestation The new attestation request.
   * @return true indicating if the pre-revocation have been performed and the revocation process should continue
   */
  function _revoke(Attestation calldata attestation) internal returns (bool) {
    if (scoreV2Schema == attestation.schema) {
      _removeScoreV2(attestation);
    } else if (scoreSchema == attestation.schema) {
      _removeScore(attestation);
    } else {
      userAttestations[attestation.recipient][attestation.schema] = 0;
    }

    return true;
  }

  /// @inheritdoc IGitcoinResolver
  function getUserAttestation(
    address user,
    bytes32 schema
  ) external view returns (bytes32) {
    return userAttestations[user][schema];
  }
}
