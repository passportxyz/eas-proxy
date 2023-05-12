// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./GitcoinAttester.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

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

contract Verifier {
    using ECDSA for bytes32;
    
    AggregatorV3Interface internal priceFeed;
    GitcoinAttester internal gitcoinAttester;

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

    constructor(address iamIssuer, address gitcoinAttesterAddress) {
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

        priceFeed = AggregatorV3Interface(
            0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43
        );

        gitcoinAttester = new GitcoinAttester();
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

    function verify(
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

    function checkFee(uint256 fee) public view returns (bool) {
        // prettier-ignore
        (
            /* uint80 roundID */,
            int price,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = priceFeed.latestRoundData();

        // Convert the price to a uint256
        uint256 ethPriceInUsd = uint256(price);

        // Calculate the fee in USD, taking into account the fact that the fee is in Wei (10^18 Wei = 1 ETH)
        uint256 feeInUsd = (fee * ethPriceInUsd) / 1e18;

        // Check if the fee is greater than $2
        return feeInUsd > 2;
    }

    function addPassportWithSignature(
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint256 fee,
        bytes32 schema,
        Passport calldata passport
    ) public returns (bool) {
        require(verify(v, r, s, passport), "Invalid signature");
        require(checkFee(fee), "Insufficient fee");

        // We are ok to add the passport
        // gitcoinAttester.addPassport(schema, passport);
    }
}
