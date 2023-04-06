// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {AttestationRequest, AttestationRequestData, IEAS, Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract GitcoinAttester {
    address private easContractAddress;
    IEAS eas;

    constructor() payable {}

    function setEASAddress(address _easContractAddress) public {
        easContractAddress = _easContractAddress;
        eas = IEAS(easContractAddress);
    }

    function addPassport(
        bytes32 schema,
        AttestationRequestData[] calldata attestationRequestData
    ) public payable virtual returns (bytes32[] memory) {
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
