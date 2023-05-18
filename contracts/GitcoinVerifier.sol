// SPDX-License-Identifier: GPL
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AttestationRequest, AttestationRequestData, IEAS, Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

import "./GitcoinAttester.sol";

/**
 * @title GitcoinVerifier
 * @notice This contract is used to verify a passport's authenticity and to add a passport to the GitcoinAttester contract using the addPassportWithSignature() function.
 */
contract GitcoinVerifier {
    using ECDSA for bytes32;

    GitcoinAttester public attester;
    address public issuer;
    string public name;
    mapping(address => uint) public recipientNonces;

    // Domain Separator, as defined by EIP-712 (`hashstruct(eip712Domain)`)
    bytes32 private DOMAIN_SEPARATOR;

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
        uint256 nonce;
        uint256 fee;
    }

    // Define the type hashes
    bytes32 private constant EIP712DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 private constant STAMP_TYPEHASH = keccak256("Stamp(string provider,string stampHash,string expirationDate,bytes encodedData)");
    bytes32 private constant PASSPORT_TYPEHASH = keccak256(
        "Passport(Stamp[] stamps,address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,uint256 value,uint256 nonce,uint256 fee)Stamp(string provider,string stampHash,string expirationDate,bytes encodedData)"
    );

    /**
     * @notice Gets the current chain ID.
     * @return chainId The chain ID.
     */
    function _getChainId() private view returns (uint256 chainId) {
        assembly {
            chainId := chainid()
        }
    }

    /**
     * @notice Constructor function to set the GitcoinAttester contract address and the contract name.
     * @param _issuer The address of the issuer of the passport.
     * @param _attester The address of the GitcoinAttester contract.
     */
    constructor(address _issuer, address _attester) {
        attester = GitcoinAttester(_attester);
        issuer = _issuer;
        name = "GitcoinVerifier";

        uint256 chainId = _getChainId();

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

    /**
     * @dev Calculates the hash of a stamp using the STAMP_TYPEHASH.
     * @param stamp The stamp to be hashed.
     * @return The hash of the stamp.
     */
    function _hashStamp(Stamp memory stamp) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            STAMP_TYPEHASH,
            keccak256(bytes(stamp.provider)),
            keccak256(bytes(stamp.stampHash)),
            keccak256(bytes(stamp.expirationDate)),
            keccak256(stamp.encodedData)
        ));
    }

    /**
     * @dev Calculates the hash of an array of strings.
     * @param array The array of strings to hash.
     * @return result The hash of the array of strings.
     */
    function _hashArray(string[] calldata array) internal pure returns (bytes32 result) {
        bytes32[] memory _array = new bytes32[](array.length);
        for (uint256 i = 0; i < array.length; ++i) {
            _array[i] = keccak256(bytes(array[i]));
        }
        result = keccak256(abi.encodePacked(_array));
    }

    /**
     * @dev Calculates the hash of a passport.
     * @param passport The passport to hash.
     * @return The hash of the passport.
     */
    function _hashPassport(Passport memory passport) internal pure returns (bytes32) {
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
            passport.value,
            passport.nonce,
            passport.fee
        ));
    }

    /**
     * @dev Verifies a passport signature.
     * @param v The v component of the signature.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param passport The passport to verify.
     * @return true if the signature is valid, false otherwise.
     */
    function _verify(
        uint8 v,
        bytes32 r,
        bytes32 s,
        Passport calldata passport
    ) internal returns (bool) {
        bytes32 passportHash = _hashPassport(passport);
        bytes32 digest = ECDSA.toTypedDataHash(DOMAIN_SEPARATOR, passportHash);

        // Recover signer from the signature
        address recoveredSigner = ECDSA.recover(digest, v, r, s);
        // Compare the recovered signer with the expected signer
         bool validSigner = recoveredSigner == issuer;

        // Check the nonce
        bool validNonce = passport.nonce == recipientNonces[passport.recipient];
        if (validNonce) {
            // Increment the nonce for this recipient
            recipientNonces[passport.recipient]++;
        }   

        // Only return true if the signer and nonce are both valid
        return validSigner && validNonce;
    }

    /**
     * @dev Adds a passport to the attester contract, verifying it using the provided signature.
     * @param schema The schema to use.
     * @param passport The passport to add.
     * @param v The v component of the signature.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     */
    function addPassportWithSignature(
        bytes32 schema,
        Passport calldata passport,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public payable virtual {
        if (_verify(v, r, s, passport) == false) {
            revert("Invalid signature");
        }

        if (msg.value < passport.fee) {
            revert("Insufficient fee");
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

        attester.addPassport(schema, attestationRequestData);
    }
}
