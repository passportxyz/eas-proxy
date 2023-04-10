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

// Define the type hash for the PassportAttestationRequest struct
bytes32 constant PASSPORT_ATTESTATION_REQUEST_TYPEHASH = keccak256(abi.encode(
    "PassportAttestationRequest(PassportStampAttestationRequest[] attestations,uint256 nonce,address recipient)"
));

// Define the type hash for the PassportStampAttestationRequest struct
bytes32 constant STAMP_ATTESTATION_TYPEHASH = keccak256(abi.encode(
    "PassportStampAttestationRequest(uint64 expirationTime,bytes data)"
));


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

    // Get the domain separator hash
    function _getDomainSeparator(string memory name, string memory version, uint256 chainId, address contractAddress) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                contractAddress
            )
        );
    }

    // Verify the EIP-712 signature
    function _verifySignature(PassportAttestationRequest calldata passportAttestationRequest, uint8 v, bytes32 r, bytes32 s) internal view returns (bool) {
        bytes32 domainSeparator = _getDomainSeparator(
            "Gitcoin Attester",
            "1",
            1,
            address(this)
        );

        bytes32[] memory hashes = new bytes32[](passportAttestationRequest.attestations.length);
        for (uint256 i = 0; i < passportAttestationRequest.attestations.length; i++) {
            hashes[i] = keccak256(abi.encode(STAMP_ATTESTATION_TYPEHASH, passportAttestationRequest.attestations[i]));
        }
        bytes32 hash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeparator,
                keccak256(
                    abi.encode(
                        PASSPORT_ATTESTATION_REQUEST_TYPEHASH,
                        hashes,
                        passportAttestationRequest.nonce, 
                        passportAttestationRequest.recipient
                    )
                )
            )
        );
        address signer = ecrecover(hash, v, r, s);
        // TODO: correct value of signer should be 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
        console.log("signer: ", signer);
        return (signer == passportAttestationRequest.recipient);
    }

    function addPassportWithSignature(
        bytes32 schema,
        PassportAttestationRequest calldata passportAttestationRequest,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public payable virtual returns (bytes32[] memory) {
        // Verify the EIP-712 signature & reject transaction if this does not match
        require(
            _verifySignature(passportAttestationRequest, v, r, s),
            "Invalid signature"
        );

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
