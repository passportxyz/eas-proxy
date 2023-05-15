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
    mapping(address => bool) public verifiers; // An allow-list of Verifiers that are authorized and trusted to call the addPassport function.

    IEAS eas; // The instance of the EAS contract.

    /**
     * @dev Checks if the given address is a Gnosis Safe contract.
     * @param addr The address to check.
     * @return A boolean indicating whether the address is a Gnosis Safe contract or not.
     */
    function _isGnosisSafe(address addr) internal view returns (bool) {
        // TODO: Check if the address is a Gnosis Safe contract.
        return true;
    }

    /**
     * @dev Adds a verifier to the allow-list.
     * @param _verifier The address of the verifier to add. It must be a Gnosis Safe contract.
     */
    function addVerifier(address _verifier) public onlyOwner {
        require(_isGnosisSafe(_verifier), "Verifier address is not a Gnosis Safe contract");
        require(!verifiers[_verifier], "Verifier already exists");
        verifiers[_verifier] = true;
    }

    /**
     * @dev Removes a verifier from the allow-list.
     * @param _verifier The address of the verifier to remove.
     */
    function removeVerifier(address _verifier) public onlyOwner {
        require(verifiers[_verifier], "Verifier does not exist");
        verifiers[_verifier] = false;
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
        require(verifiers[msg.sender], "Only authorized verifiers can call this function");

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
