// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

struct EIP712Domain {
    string name;
}

struct Stamp {
    string provider;
    string stampHash;
    string expirationDate;
}

struct Passport {
    Stamp[] stamps;
}

contract Verifier {
    address public issuer;
    string public name;

    // Define the type hashes
    bytes32 private constant EIP712DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name)");
    bytes32 private constant STAMP_TYPEHASH = keccak256("Stamp(string provider,string stampHash,string expirationDate)");
    bytes32 private constant PASSPORT_TYPEHASH = keccak256("Passport(Stamp[] stamps)");

    // Domain Separator, as defined by EIP-712 (`hashstruct(eip712Domain)`)
    bytes32 public DOMAIN_SEPARATOR;

    constructor(address iamIssuer) {
        issuer = iamIssuer;
        name = "Attester";
    }

    function _hashStamp(Stamp memory stamp) private pure returns (bytes32) {
        return keccak256(abi.encode(
            STAMP_TYPEHASH,
            keccak256(bytes(stamp.provider)),
            keccak256(bytes(stamp.stampHash)),
            keccak256(bytes(stamp.expirationDate))
        ));
    }

    function _hashPassport(Passport memory passport) private pure returns (bytes32) {
        bytes32 stampHash = _hashStamp(passport.stamps[0]);
        bytes32 stampHash1 = _hashStamp(passport.stamps[1]);
        bytes32 stampHash2 = _hashStamp(passport.stamps[2]);

        return keccak256(abi.encode(
            PASSPORT_TYPEHASH,
            keccak256(abi.encodePacked([stampHash,stampHash1,stampHash2]))
        ));
    }

    function verify(
        uint8 v,
        bytes32 r,
        bytes32 s,
        Passport calldata passport
    ) public view returns (bool) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                EIP712DOMAIN_TYPEHASH,
                keccak256(bytes(name))
            )
        );

        bytes32 passportHash = _hashPassport(passport);

        bytes32 digest = ECDSA.toTypedDataHash(domainSeparator, passportHash);

        // Recover signer from the signature
        address recoveredSigner = ECDSA.recover(digest, v, r, s);
        console.log(recoveredSigner, issuer);
        // Compare the recovered signer with the expected signer
        return recoveredSigner == issuer;
    }
}
