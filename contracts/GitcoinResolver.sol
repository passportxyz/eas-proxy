// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import { Initializable, OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { AttestationRequest, AttestationRequestData, EAS, Attestation, MultiAttestationRequest, IEAS } from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";
import { InvalidEAS } from "@ethereum-attestation-service/eas-contracts/contracts/Common.sol";

import { GitcoinAttester } from "./GitcoinAttester.sol";

/**
 * @title GitcoinResolver
 * @notice This contract is used to as a resolver contract for EAS schemas, and it will track the last attestation issued for a given recipient.
 */
contract GitcoinResolver is
  Initializable,
  UUPSUpgradeable,
  OwnableUpgradeable,
  PausableUpgradeable,
  ISchemaResolver
{
  error AccessDenied();
  error InsufficientValue();
  error NotPayable();
  error InvalidAttestationSchema();

  // Mapping of Passport addresses to attestation UIDs
  mapping(address => bytes32) public passports;
  mapping(address => bytes32) public scores;

  // The global EAS contract.
  IEAS public _eas;

  // Gitcoin Attester contract
  GitcoinAttester public _gitcoinAttester;

  bytes32 public passportSchema;
  bytes32 public scoreSchema;

  // Emitted when a passport is added to the passports mapping
  event PassportAdded(address recipient, bytes32 recipientUid);
  // Emitted when a passport is removed from the passports mapping
  event PassportRemoved(address recipient, bytes32 recipientUid);

  // Emitted when a score is added to the scores mapping
  event ScoreAdded(address recipient, bytes32 recipientUid);
  // Emitted when a score is removed from the scores mapping
  event ScoreRemoved(address recipient, bytes32 recipientUid);

  event UpdatedPassportSchema(bytes32 passportSchema);
  event UpdatedScoreSchema(bytes32 scoreSchema);

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
  }

  /**
   * @dev Ensures that only the EAS contract can make this call.
   */
  modifier _onlyEAS() {
    require(
      msg.sender == address(_eas),
      "Only EAS can call this function"
    );

    _;
  }

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address) internal override onlyOwner {}

  function setPassportSchema(bytes32 _passportSchema) public onlyOwner {
    passportSchema = _passportSchema;
    emit UpdatedPassportSchema(_passportSchema);
  }

  function setScoreSchema(bytes32 _scoreSchema) public onlyOwner {
    scoreSchema = _scoreSchema;
    emit UpdatedScoreSchema(_scoreSchema);
  }

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
  ) external payable whenNotPaused _onlyEAS returns (bool) {
    return _attest(attestation);
  }

  function _attest(Attestation calldata attestation) internal returns (bool) {
    require(
      attestation.attester == address(_gitcoinAttester),
      "Invalid attester"
    );

    if (attestation.schema == passportSchema) {
      passports[attestation.recipient] = attestation.uid;
      emit PassportAdded(attestation.recipient, attestation.uid);
    } else if (attestation.schema == scoreSchema) {
      scores[attestation.recipient] = attestation.uid;
      emit ScoreAdded(attestation.recipient, attestation.uid);
    } else {
      revert InvalidAttestationSchema();
    }

    return true;
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
  ) external payable whenNotPaused _onlyEAS returns (bool) {
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
  ) external payable whenNotPaused _onlyEAS returns (bool) {
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
  ) external payable whenNotPaused _onlyEAS returns (bool) {
    for (uint i = 0; i < attestations.length; ) {
      _revoke(attestations[i]);

      unchecked {
        ++i;
      }
    }
    return true;
  }

  function _revoke(Attestation calldata attestation) internal returns (bool) {
    if (passports[attestation.recipient] == attestation.uid) {
      passports[attestation.recipient] = 0;
      emit PassportRemoved(attestation.recipient, attestation.uid);
    } else if (scores[attestation.recipient] == attestation.uid) {
      scores[attestation.recipient] = 0;
      emit ScoreRemoved(attestation.recipient, attestation.uid);
    }

    return true;
  }
}
