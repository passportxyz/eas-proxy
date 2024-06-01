// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "hardhat/console.sol";

import "./GitcoinAttester.sol";

/**
 * @title GitcoinVerifier
 * @notice This contract is used to verify a passport's authenticity and to add a passport to the GitcoinAttester contract using the verifyAndAttest() function.
 */
contract GitcoinStampVerifier {
    using ECDSA for bytes32;

    // Address of the issuer of the passport
    address public issuer;

    // Domain Separator, as defined by EIP-712 (`hashstruct(eip712Domain)`)
    bytes32 private DOMAIN_SEPARATOR;

    // Name of the contract
    string public name;

    struct Proof {
        // underscored since @ is not valid for struct member
        string _context;
                // underscored since typoe is a reserved keyword
        string _type;
        string proofPurpose;
        string verificationMethod;
        string created;
    }

    struct CredentialSubjectContext {
        string customInfo;
        string _hash;
        string metaPointer;
        string provider;
    }

    struct Customifo {
        string description;
    }

    struct CredentialSubject {
        string id;
        CredentialSubjectContext _context;
        string provider;
        // Customifo customInfo;
        // underscored since hash is a reserved keyword
        string _hash;
    }


    struct Document {
        // underscored since @ is not valid for struct member
        string[] _context;
        // underscored since @ is not valid for struct member
        string[] _type;
        CredentialSubject credentialSubject;
        string issuer;
        string issuanceDate;
        Proof proof;
        string expirationDate;
    }

    bytes32 private constant PROOF_TYPE_HASH =
        keccak256("Proof(string @context,string type,string proofPurpose,string verificationMethod,string created)");

    bytes32 private constant CREDENTIAL_SUBJECT_CONTEXT_TYPEHASH =
        keccak256("CredentialSubjectContext(string customInfo,string hash,string metaPointer,string provider)");

    // bytes32 private constant CUSTOMINFO_TYPEHASH = keccak256("CustomInfo(string description)");

    bytes32 private constant CREDENTIAL_SUBJECT_TYPEHASH =
        keccak256(
            "CredentialSubject(string id,CredentialSubjectContext @context,string provider,string hash)"
        );

    bytes32 private constant DOCUMENT_TYPEHASH =
        keccak256(
            "Document(string[] @context,string[] type,CredentialSubject credentialSubject,string issuer,string issuanceDate,Proof proof,string expirationDate)"
        );

    bytes32 private constant EIP712DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name)");

    /**
    * @notice Initializer function responsible for setting up the contract's initial state.
    * @param _issuer The address of the issuer of the passport.
    */
    function initialize(address _issuer) public {

        issuer = _issuer;
        name = "GitcoinPassportStampVerifiableCredential";

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712DOMAIN_TYPEHASH,
                keccak256(bytes(name))
            )
        );
    }

    function hashCredentialSubjectContext(CredentialSubjectContext calldata context) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                CREDENTIAL_SUBJECT_CONTEXT_TYPEHASH,
                keccak256(bytes(context.customInfo)),
                keccak256(bytes(context._hash)),
                keccak256(bytes(context.metaPointer)),
                keccak256(bytes(context.provider))
            )
        );
    }


    function hashCredentialSubject(CredentialSubject calldata subject) public pure returns (bytes32) {
        bytes32 credentialSubjectContext = hashCredentialSubjectContext(subject._context);

        return
            keccak256(
                abi.encode(
                    CREDENTIAL_SUBJECT_TYPEHASH,
                    keccak256(bytes(subject.id)),
                    credentialSubjectContext,
                    keccak256(bytes(subject.provider)),
                    keccak256(bytes(subject._hash))
                )
            );
    }

    function hashCredentialProof(Proof calldata proof) public pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    PROOF_TYPE_HASH,
                    keccak256(bytes(proof._context)),
                    keccak256(bytes(proof._type)),
                    keccak256(bytes(proof.proofPurpose)),
                    keccak256(bytes(proof.verificationMethod)),
                    keccak256(bytes(proof.created))
                )
            );
    }

    function _hashArray(string[] calldata array) internal pure returns (bytes32 result) {
        bytes32[] memory _array = new bytes32[](array.length);
        for (uint256 i = 0; i < array.length; ++i) {
            _array[i] = keccak256(bytes(array[i]));
        }
        result = keccak256(abi.encodePacked(_array));
    }

    function hashDocument(Document calldata document) public pure returns (bytes32) {
        bytes32 credentialSubjectHash = hashCredentialSubject(document.credentialSubject);
        bytes32 proofHash = hashCredentialProof(document.proof);

        return
            keccak256(
                abi.encode(
                    DOCUMENT_TYPEHASH,
                    _hashArray(document._context),
                    _hashArray(document._type),
                    credentialSubjectHash,
                    keccak256(bytes(document.issuer)),
                    keccak256(bytes(document.issuanceDate)),
                    proofHash,
                    keccak256(bytes(document.expirationDate))
                )
            );
    }

    function verifyStampVc(Document calldata document, bytes memory signature) public view returns (bool) {
        bytes32 vcHash = hashDocument(document);
        bytes32 digest = ECDSA.toTypedDataHash(DOMAIN_SEPARATOR, vcHash);

        address recoveredAddress = ECDSA.recover(digest, signature);

        console.log(recoveredAddress, issuer, "recoveredAddress, issuer, ");

        // Here we could check the issuer's address against an on-chain registry.
        // We could provide a verifying contract address when signing the credential which could correspond to this contract
        require(recoveredAddress == issuer, "VC verification failed issuer does not match signature");

        return true;
    }
}
