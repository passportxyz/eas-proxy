// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {AttestationRequest, AttestationRequestData, IEAS, Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import {Verifier, Passport, Stamp} from "./Verifier.sol";

struct PassportStampAttestationRequest {
    uint64 expirationDate; // The time when the attestation expires (Unix timestamp).
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
        Passport calldata passport,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public payable virtual returns (bytes32[] memory) {
        // if (verify(v, r, s, passport) == false) {
        //     revert("Invalid signature");
        // }

        bytes32[] memory ret = new bytes32[](
            passport.stamps.length
        );
        for (
            uint i = 0;
            i < passport.stamps.length;
            i++
        ) {
            Stamp memory stamp = passport.stamps[i];

            AttestationRequest memory attestationRequest = AttestationRequest({
                schema: schema,
                data: AttestationRequestData({
                    recipient: passport.recipient, // The recipient of the attestation.
                    expirationTime: 0, // The time when the attestation expires (Unix timestamp).
                    revocable: true, // Whether the attestation is revocable.
                    refUID: 0, // The UID of the related attestation.
                    data: stamp.encodedData, // Custom attestation data.
                    value: 0 // An explicit ETH amount to send to the resolver. This is important to prevent accidental user errors.
                })
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
