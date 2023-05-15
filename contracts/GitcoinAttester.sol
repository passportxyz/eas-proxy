// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import {AttestationRequest, AttestationRequestData, IEAS, Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";


contract GitcoinAttester is Ownable {
    address private easContractAddress;
    address public verifier;

    IEAS eas;

    function setVerifier(address _verifier) public onlyOwner {
        verifier = _verifier;
    }

    function setEASAddress(address _easContractAddress) public onlyOwner {
        easContractAddress = _easContractAddress;
        eas = IEAS(easContractAddress);
    }

    function addPassport(
        bytes32 schema,
        AttestationRequestData[] calldata attestationRequestData
    ) public payable virtual returns (bytes32[] memory) {
        require(msg.sender == verifier, "Only the Verifier contract can call this function");

        bytes32[] memory ret = new bytes32[](attestationRequestData.length);
        for (uint i = 0; i < attestationRequestData.length; i++) {
            AttestationRequest memory attestationRequest = AttestationRequest({
                schema: schema,
                data: attestationRequestData[i]
            });
            ret[i] = eas.attest(attestationRequest);
        }
        return ret;
    }

    function getAttestation(
        bytes32 uid
    ) external view returns (Attestation memory) {
        return eas.getAttestation(uid);
    }
}
