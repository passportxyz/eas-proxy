// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import {AttestationRequest, AttestationRequestData, EAS, Attestation, MultiAttestationRequest} from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import {ISchemaResolver} from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";
import {InvalidEAS} from "./Common.sol";

import "./GitcoinAttester.sol";
// TODO: Make this contract pausable, upgradeable, and ownable
/**
 * @title GitcoinResolver
 * @notice This contract is used to as a resolver contract for EAS schemas, and it will track the last attestation issued for a given recipient.
 */
contract GitcoinResolver is ISchemaResolver {
    error AccessDenied();
    error InsufficientValue();
    error NotPayable();

    // Mapping of Passport addresses to attestation UIDs
    mapping(address => bytes32) public passports;

    // The global EAS contract.
    IEAS internal immutable _eas;

    // Gitcoin Attester contract
    GitcoinAttester internal immutable _gitcoinAttester;

    /**
     * @dev Creates a new resolver.
     * @param eas The address of the global EAS contract
     * @param gitcoinAttester The address of the Gitcoin Attester contract.
     */
    constructor(IEAS eas, GitcoinAttester gitcoinAttester) {
        if (address(eas) == address(0)) {
            revert InvalidEAS();
        }
        _eas = eas;
        _gitcoinAttester = gitcoinAttester;
    }

    /**
     * @dev Ensures that only the EAS contract can make this call.
     */
    modifier onlyEAS() {
        require(msg.sender == address(_eas), "Only EAS contract can call this function");

        _;
    }
    
    /**
     * @dev Returns whether the resolver supports ETH transfers. Required function from the interface ISchemaResolver
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
    ) external payable onlyEAS returns (bool) {
        if (attestation.attester == address(_gitcoinAttester)) {
            passports[attestation.recipient] = attestation.uid;
        } 
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
    ) external payable onlyEAS returns (bool) {
        values;
        bool allAttested = true;
        for (uint i = 0; i < attestations.length; i++) {
            if (attestations[i].attester == address(_gitcoinAttester)) {
                passports[msg.sender] = attestations[i].uid;
            } else {
                allAttested = false;
                break;
            }
        }
        return allAttested;
    }

    /**
     * @dev Processes an attestation revocation and verifies if it can be revoked.
     * @param attestation The existing attestation to be revoked.
     * @return Whether the attestation can be revoked.
     * @inheritdoc ISchemaResolver
     */
    function revoke(
        Attestation calldata attestation
    ) external payable onlyEAS returns (bool) {
        if (passports[msg.sender] == attestation.uid) {
            passports[msg.sender] = 0;
        }
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
    ) external payable onlyEAS returns (bool) {
        values;
        for (uint i = 0; i > attestations.length; i++) {
            if (passports[msg.sender] == attestations[i].uid) {
                passports[msg.sender] = 0;
            }
        }
        return true;
    }
}
