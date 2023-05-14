// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AttestationRequest, AttestationRequestData, IEAS, Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

import "./GitcoinAttester.sol";


struct EIP712Domain {
    string name;
    string version;
    uint256 chainId;
    address verifyingContract;
}

struct Stamp {
    string provider;
    string stampHash;
    string expirationDate;
    bytes encodedData;
}

struct Passport {
    Stamp[] stamps;
    address recipient;
    uint64 expirationTime;
    bool revocable;
    bytes32 refUID;
    uint256 value;
}

// struct PassportStampAttestationRequest {
//     uint64 expirationDate; // The time when the attestation expires (Unix timestamp).
//     bytes data; // Custom attestation data.
// }

// struct PassportAttestationRequest {
//     PassportStampAttestationRequest[] attestations; // The individual requests for each stamp
//     uint256 nonce; // A unique nonce to prevent replay attacks.
//     address recipient; // The receiver of the attestations
// }

contract Verifier {
    using ECDSA for bytes32;

    GitcoinAttester public attester;
    address public issuer;
    string public name;

    // Define the type hashes
    bytes32 private constant EIP712DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant STAMP_TYPEHASH = keccak256("Stamp(string provider,string stampHash,string expirationDate,bytes encodedData)");
    bytes32 private constant PASSPORT_TYPEHASH = keccak256(
        "Passport(Stamp[] stamps,address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,uint256 value)Stamp(string provider,string stampHash,string expirationDate,bytes encodedData)"
    );


    // Domain Separator, as defined by EIP-712 (`hashstruct(eip712Domain)`)
    bytes32 public DOMAIN_SEPARATOR;

    function getChainId() public view returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }

    constructor(address iamIssuer, address _attester) {
        attester = GitcoinAttester(_attester);
        issuer = iamIssuer;
        name = "Attester";

        uint256 chainId = getChainId();

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes("1")), // version
                chainId, // chainId
                address(this) // verifyingContract
            )
        );
    }

    function _hashStamp(Stamp memory stamp) private pure returns (bytes32) {
        return keccak256(abi.encode(
            STAMP_TYPEHASH,
            keccak256(bytes(stamp.provider)),
            keccak256(bytes(stamp.stampHash)),
            keccak256(bytes(stamp.expirationDate)),
            keccak256(stamp.encodedData)
        ));
    }

    function _hashArray(string[] calldata array) internal pure returns (bytes32 result) {
        bytes32[] memory _array = new bytes32[](array.length);
        for (uint256 i = 0; i < array.length; ++i) {
            _array[i] = keccak256(bytes(array[i]));
        }
        result = keccak256(abi.encodePacked(_array));
    }

    function _hashPassport(Passport memory passport) private pure returns (bytes32) {
        bytes32[] memory _array = new bytes32[](passport.stamps.length);

        for (uint256 i = 0; i < passport.stamps.length; ++i) {
            _array[i] = _hashStamp(passport.stamps[i]);
        }

        bytes32 hashedArray = keccak256(abi.encodePacked(_array));

        return keccak256(abi.encode(
            PASSPORT_TYPEHASH,
            hashedArray,
            passport.recipient,
            passport.expirationTime,
            passport.revocable,
            passport.refUID,
            passport.value
        ));
    }

    function _verify(
        uint8 v,
        bytes32 r,
        bytes32 s,
        Passport calldata passport
    ) public view returns (bool) {
        bytes32 passportHash = _hashPassport(passport);
        bytes32 digest = ECDSA.toTypedDataHash(DOMAIN_SEPARATOR, passportHash);

        // Recover signer from the signature
        address recoveredSigner = ECDSA.recover(digest, v, r, s);
        // Compare the recovered signer with the expected signer
        return recoveredSigner == issuer;
    }

    function addPassportWithSignature(
        bytes32 schema,
        Passport calldata passport,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public payable virtual returns (bytes32[] memory) {
        if (_verify(v, r, s, passport) == false) {
            revert("Invalid signature");
        }

        AttestationRequestData[] memory attestationRequestData = new AttestationRequestData[](passport.stamps.length);

        for (
            uint i = 0;
            i < passport.stamps.length;
            i++
        ) {
            Stamp memory stamp = passport.stamps[i];

            attestationRequestData[i] = AttestationRequestData({
                recipient: passport.recipient, // The recipient of the attestation.
                expirationTime: 0, // The time when the attestation expires (Unix timestamp).
                revocable: true, // Whether the attestation is revocable.
                refUID: 0, // The UID of the related attestation.
                data: stamp.encodedData, // Custom attestation data.
                value: 0 // An explicit ETH amount to send to the resolver. This is important to prevent accidental user errors.
            });
        }

        bytes32[] memory ret = attester.addPassport(schema, attestationRequestData);

        return ret;
    }
}
