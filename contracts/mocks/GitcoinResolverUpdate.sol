// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import {AttestationRequest, AttestationRequestData, EAS, Attestation, MultiAttestationRequest} from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import {ISchemaResolver} from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";
import {InvalidEAS} from "../Common.sol";

import "../GitcoinAttester.sol";
/**
 * @title GitcoinResolverUpdate
 * @notice This contract is used to as a resolver contract for EAS schemas, and it will track the last attestation issued for a given recipient.
 */
contract GitcoinResolverUpdate is UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable, ISchemaResolver {
    error AccessDenied();
    error InsufficientValue();
    error NotPayable();

    // Mapping of Passport addresses to attestation UIDs
    mapping(address => bytes32) public passports;

    // The global EAS contract.
    IEAS public eas;

    // Gitcoin Attester contract
    GitcoinAttester public gitcoinAttester;

    // Emitted when a passport is added to the passports mapping
    event PassportAdded(address recipient, bytes32 recipientUid);
    // Emitted when a passport is removed from the passports mapping
    event PassportRemoved(address recipient, bytes32 recipientUid);

    /**
     * @dev Creates a new resolver.
     * @notice Initializer function responsible for setting up the contract's initial state.
     * @param _eas The address of the global EAS contract
     * @param _gitcoinAttester The address of the Gitcoin Attester contract.
     */
    function initialize(IEAS _eas, GitcoinAttester _gitcoinAttester) public initializer {
        __Ownable_init();
        __Pausable_init();

        if (address(_eas) == address(0)) {
            revert InvalidEAS();
        }
        eas = _eas;
        gitcoinAttester = _gitcoinAttester;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev Ensures that only the EAS contract can make this call.
     */
    modifier onlyEAS() {
        require(msg.sender == address(eas), "Only EAS contract can call this function");

        _;
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
    ) external payable whenNotPaused onlyEAS returns (bool) {
        require(attestation.attester == address(gitcoinAttester), "Only the Gitcoin Attester can make attestations");
        passports[attestation.recipient] = attestation.uid;

        emit PassportAdded(attestation.recipient, attestation.uid);
        return true;
    }

    /**
     * @dev Processes multiple attestations and verifies whether they are valid.
     * @param attestations The new attestations.
     * @param values Explicit ETH amounts which were sent with each attestation.
     * @return Whether all the attestations are valid.
     * @inheritdoc ISchemaResolver
     */
    function multiAttest(
        Attestation[] calldata attestations,
        uint256[] calldata values
    ) external payable whenNotPaused onlyEAS returns (bool) {
        values;
        for (uint i = 0; i < attestations.length;) {
            require(attestations[i].attester == address(gitcoinAttester), "Only the Gitcoin Attester can make attestations");
            passports[attestations[i].recipient] = attestations[i].uid;
            emit PassportAdded(attestations[i].recipient, attestations[i].uid);
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
    ) external payable whenNotPaused returns (bool) {
        if (passports[attestation.recipient] == attestation.uid) {
            passports[attestation.recipient] = 0;
        }
        emit PassportRemoved(attestation.recipient, attestation.uid);
        return true;
    }

    /**
     * @dev Processes revocation of multiple attestation and verifies they can be revoked.
     * @param attestations The existing attestations to be revoked.
     * @param values Explicit ETH amounts which were sent with each revocation.
     * @return Whether the attestations can be revoked.
     * @inheritdoc ISchemaResolver
     */
    function multiRevoke(
        Attestation[] calldata attestations,
        uint256[] calldata values
    ) external payable whenNotPaused returns (bool) {
        values;
        for (uint i = 0; i < attestations.length; ++i) {
            if (passports[attestations[i].recipient] == attestations[i].uid) {
                passports[attestations[i].recipient] = 0;
                emit PassportRemoved(attestations[i].recipient, attestations[i].uid);
            }
        }
        return true;
    }
}
