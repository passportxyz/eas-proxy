// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {AttestationRequest, AttestationRequestData, IEAS, Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

struct PassportStampAttestationRequest {
    uint64 expirationTime; // The time when the attestation expires (Unix timestamp).
    bytes data; // Custom attestation data.
}

struct PassportAttestationRequest {
    PassportStampAttestationRequest[] attestations; // The individual requests for each stamp
    uint256 nonce; // A unique nonce to prevent replay attacks.
    address recipient; // The receiver of the attestations
}

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

    function addPassportWithSignature(
        bytes32 schema,
        PassportAttestationRequest calldata passportAttestationRequest,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public payable virtual returns (bytes32[] memory) {
        // TODO: verify the EIP-712 signature & reject transaction if this does not match
        bytes32[] memory ret = new bytes32[](
            passportAttestationRequest.attestations.length
        );
        for (
            uint i = 0;
            i < passportAttestationRequest.attestations.length;
            i++
        ) {
            console.log("Handling stamp #", i);
            PassportStampAttestationRequest
                memory stamp = passportAttestationRequest.attestations[i];
            AttestationRequest memory attestationRequest = AttestationRequest({
                schema: schema,
                data: AttestationRequestData({
                    recipient: passportAttestationRequest.recipient, // The recipient of the attestation.
                    expirationTime: stamp.expirationTime, // The time when the attestation expires (Unix timestamp).
                    revocable: true, // Whether the attestation is revocable.
                    refUID: 0, // The UID of the related attestation.
                    data: stamp.data, // Custom attestation data.
                    value: 0 // An explicit ETH amount to send to the resolver. This is important to prevent accidental user errors.
                })
            });
            console.log("attestation request.recipient:", attestationRequest.data.recipient);
            console.log("attestation request.expirationTime:", attestationRequest.data.expirationTime);
            console.log("attestation request.revocable:", attestationRequest.data.revocable);
            // console.log("attestation request.refUID:", attestationRequest.data.refUID);
            console.log("attestation request.value:", attestationRequest.data.value);
            console.log("attestation request.expirationTime:", attestationRequest.data.expirationTime);
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
