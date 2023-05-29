// SPDX-License-Identifier: GPL
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import {AttestationRequest, AttestationRequestData, IEAS, Attestation, MultiAttestationRequest} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

import "./GitcoinAttester.sol";

/**
 * @title GitcoinVerifier
 * @notice This contract is used to verify a passport's authenticity and to add a passport to the GitcoinAttester contract using the addPassportWithSignature() function.
 */
contract GitcoinVerifier is Ownable {
    using ECDSA for bytes32;

    // Instance of the GitcoinAttester contract
    GitcoinAttester public attester;

    // Address of the issuer of the passport
    address public issuer;

    // Name of the contract
    string public name;

    // Nonces for each recipient address
    mapping(address => uint) public recipientNonces;

    // Domain Separator, as defined by EIP-712 (`hashstruct(eip712Domain)`)
    bytes32 private DOMAIN_SEPARATOR;

    /**
     * @dev EIP712Domain represents the domain separator struct for EIP-712 typed data hashing.
     */
    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
        address verifyingContract;
    }

    /**
     * @dev Stamp represents an attestation stamp with encoded data.
     */
    struct Stamp {
        bytes encodedData;
    }

    /**
     * @dev Passport represents a passport object with multiple stamps and associated information.
     */
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

    // Hash type for the EIP712 domain separator
    bytes32 private constant EIP712DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
    
    // Hash type for the Stamp struct
    bytes32 private constant STAMP_TYPEHASH =
        keccak256("Stamp(bytes encodedData)");

    // Hash type for the Passport struct
    bytes32 private constant PASSPORT_TYPEHASH =
        keccak256(
            "Passport(Stamp[] stamps,address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,uint256 value,uint256 nonce,uint256 fee)Stamp(bytes encodedData)"
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
    * @notice Allow owner of the contract to withdraw earned fees
    */
    function withdrawFees() public onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    /**
     * @dev Calculates the hash of a stamp using the STAMP_TYPEHASH.
     * @param stamp The stamp to be hashed.
     * @return The hash of the stamp.
     */
    function _hashStamp(Stamp memory stamp) internal pure returns (bytes32) {
        return
            keccak256(abi.encode(STAMP_TYPEHASH, keccak256(stamp.encodedData)));
    }

    /**
     * @dev Calculates the hash of an array of strings.
     * @param array The array of strings to hash.
     * @return result The hash of the array of strings.
     */
    function _hashArray(
        string[] calldata array
    ) internal pure returns (bytes32 result) {
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
    function _hashPassport(
        Passport calldata passport
    ) internal pure returns (bytes32) {
        bytes32[] memory _array = new bytes32[](passport.stamps.length);

        for (uint i; i < passport.stamps.length; ) {
            _array[i] = _hashStamp(passport.stamps[i]);
            unchecked {
                ++i;
            }
        }

        bytes32 hashedArray = keccak256(abi.encodePacked(_array));

        return
            keccak256(
                abi.encode(
                    PASSPORT_TYPEHASH,
                    hashedArray,
                    passport.recipient,
                    passport.expirationTime,
                    passport.revocable,
                    passport.refUID,
                    passport.value,
                    passport.nonce,
                    passport.fee
                )
            );
    }

    /**
     * @dev Verifies a passport signature.
     * @param v The v component of the signature.
     * @param r The r component of the signature.
     * @param s The s component of the signature.
     * @param passport The passport to verify.
     */
    function _verify(
        uint8 v,
        bytes32 r,
        bytes32 s,
        Passport calldata passport
    ) internal {
        if (passport.nonce != recipientNonces[passport.recipient]) {
            revert("Invalid nonce");
        }

        bytes32 passportHash = _hashPassport(passport);
        bytes32 digest = ECDSA.toTypedDataHash(DOMAIN_SEPARATOR, passportHash);

        // Compare the recovered signer with the expected signer
        if(ECDSA.recover(digest, v, r, s) != issuer) {
            revert("Invalid signature");
        }

        // Increment the nonce for this recipient
        recipientNonces[passport.recipient]++;
    }

    /**
     * @dev Creates a multi-attestation request based on the given schema and passport.
     * @param schema The schema to use for the attestation request.
     * @param passport The passport containing the stamps for the attestation request.
     * @return The array of multi-attestation requests.
     */
    function getMultiAttestRequest(
        bytes32 schema,
        Passport calldata passport
    ) public pure returns (MultiAttestationRequest[] memory) {
        MultiAttestationRequest[]
            memory multiAttestationRequest = new MultiAttestationRequest[](1);
        multiAttestationRequest[0].schema = schema;
        multiAttestationRequest[0].data = new AttestationRequestData[](
            passport.stamps.length
        );

        for (uint i; i < passport.stamps.length; ) {
            Stamp memory stamp = passport.stamps[i];
            multiAttestationRequest[0].data[i] = AttestationRequestData({
                recipient: passport.recipient, // The recipient of the attestation.
                expirationTime: 0, // The time when the attestation expires (Unix timestamp).
                revocable: true, // Whether the attestation is revocable.   ==> TODO: use revocable from Passport
                refUID: 0, // The UID of the related attestation.
                data: stamp.encodedData, // Custom attestation data.
                value: 0 // An explicit ETH amount to send to the resolver. This is important to prevent accidental user errors.
            });

            unchecked {
                ++i;
            }
        }

        return multiAttestationRequest;
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
    ) public payable {
        if (msg.value < passport.fee) {
            revert("Insufficient fee");
        }

        _verify(v, r, s, passport);

        attester.addPassport(getMultiAttestRequest(schema, passport));
    }
}
