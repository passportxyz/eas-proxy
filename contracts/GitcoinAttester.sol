// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import {AttestationRequest, AttestationRequestData, IEAS, Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

/**
 * @title GitcoinAttester
 * @dev A contract that allows a Verifier contract to add passport information for users using Ethereum Attestation Service.
 */
contract GitcoinAttester is Ownable {
    address private easContractAddress; // The address of the EAS contract.
    address public verifier; // The address of the contract that verifies that a user is eligible to add a passport.

    IEAS eas; // The instance of the EAS contract.


    /**
     * @dev Sets the address of the Verifier contract.
     * @param _verifier The address of the Verifier contract.
     */
    function setVerifier(address _verifier) public onlyOwner {
        verifier = _verifier;
    }

    /**
     * @dev Sets the address of the EAS contract.
     * @param _easContractAddress The address of the EAS contract.
     */
    function setEASAddress(address _easContractAddress) public onlyOwner {
        easContractAddress = _easContractAddress;
        eas = IEAS(easContractAddress);
    }

    /**
     * @dev Adds passport information for a user using EAS.
     * @param schema The ID of the schema to use.
     * @param attestationRequestData An array of `AttestationRequestData` structures containing the user's passport information.
     * @return ret An array of `bytes32` values representing the unique identifiers of the attestations.
     */
    function addPassport(
        bytes32 schema,
        AttestationRequestData[] calldata attestationRequestData
    ) public payable virtual returns (bytes32[] memory ret) {
        require(msg.sender == verifier, "Only the Verifier contract can call this function");

        ret = new bytes32[](attestationRequestData.length);
        for (uint i = 0; i < attestationRequestData.length; i++) {
            AttestationRequest memory attestationRequest = AttestationRequest({
                schema: schema,
                data: attestationRequestData[i]
            });
            ret[i] = eas.attest(attestationRequest);
        }
    }

    /**
     * @dev Retrieves an attestation for a given unique identifier from EAS.
     * @param uid The unique identifier of the attestation to retrieve.
     * @return An `Attestation` structure representing the attestation.
     */
    function getAttestation(
        bytes32 uid
    ) external view returns (Attestation memory) {
        return eas.getAttestation(uid);
    }
}
