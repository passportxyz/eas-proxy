// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import {AttestationRequest, AttestationRequestData, EAS, Attestation, MultiAttestationRequest} from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import {ISchemaResolver} from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";

import "./GitcoinAttester.sol";

/**
 * @title GitcoinResolver
 * @notice This contract is used to as a resolver contract for EAS schemas, and it will track the last attestation issued for a given recipient.
 */
contract GitcoinResolver is ISchemaResolver {
    mapping(address => bytes32) public passports;
    mapping(bytes32 => address) public uuids;
    uint256 private counter = 0;

    function createUUID() public returns (bytes32) {
        counter++;
        return keccak256(abi.encodePacked(msg.sender, counter));
    }

    function setUUID() public {
        require(passports[msg.sender] == bytes32(0), "Address already has a UUID.");
        recipientUUID = createUUID();
        uuids[recipientUUID] = msg.sender;
        passports[msg.sender] = recipientUUID;
    }

    function getUUID() public returns (bytes32) {
        return passports[msg.sender];
    }

    /**
     * @inheritdoc ISchemaResolver
     */
    function isPayable() external pure returns (bool) {
        // TODO: implement this
        return false;
    }

    /**
     * @inheritdoc ISchemaResolver
     */
    function attest(
        Attestation calldata attestation
    ) external payable returns (bool) {
        // TODO: implement this
        return false;
    }

    /**
     * @inheritdoc ISchemaResolver
     */
    function multiAttest(
        Attestation[] calldata attestations,
        uint256[] calldata values
    ) external payable returns (bool) {
        // TODO: implement this
        return false;
    }

    /**
     * @inheritdoc ISchemaResolver
     */
    function revoke(
        Attestation calldata attestation
    ) external payable returns (bool) {
        // TODO: implement this
        return false;
    }

    /**
     * @inheritdoc ISchemaResolver
     */
    function multiRevoke(
        Attestation[] calldata attestations,
        uint256[] calldata values
    ) external payable returns (bool) {
        // TODO: implement this
        return false;
    }
}
