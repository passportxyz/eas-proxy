// SPDX-License-Identifier: GPL
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "hardhat/console.sol";

import "./GitcoinAttester.sol";

/**
 * @title GitcoinVerifier
 * @notice This contract is used to verify a passport's authenticity and to add a passport to the GitcoinAttester contract using the addPassportWithSignature() function.
 */
contract GitcoinScoreVerifier {
  using ECDSA for bytes32;

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

  struct Score {
    address recipient;
    uint64 expirationTime;
    uint256 value;
    uint256 nonce;
    bytes32 stampsHash;
  }

  // Define the type hashes
  bytes32 private constant EIP712DOMAIN_TYPEHASH =
    keccak256(
      "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
  bytes32 private constant SCORE_TYPEHASH =
    keccak256(
      "Score(address recipient,uint64 expirationTime,uint256 value,uint256 nonce,bytes32 stampsHash)"
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
    issuer = _issuer;
    name = "GitcoinScoreVerifier";

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
   * @dev Calculates the hash of a passport.
   * @param score The score to hash.
   * @return The hash of the passport.
   */
  function _hashScore(Score memory score) internal pure returns (bytes32) {
    // bytes32[] memory _array = new bytes32[](passport.stamps.length);

    // for (uint256 i = 0; i < passport.stamps.length; ++i) {
    //   _array[i] = _hashStamp(passport.stamps[i]);
    // }

    // bytes32 hashedArray = keccak256(abi.encodePacked(_array));

    return
      keccak256(
        abi.encode(
          SCORE_TYPEHASH,
          score.recipient,
          score.expirationTime,
          score.value,
          score.nonce,
          score.stampsHash
        )
      );
  }

  /**
   * @dev Verifies a passport signature.
   * @param v The v component of the signature.
   * @param r The r component of the signature.
   * @param s The s component of the signature.
   * @param score The passport to verify.
   * @return true if the signature is valid, false otherwise.
   */
  function _verify(
    uint8 v,
    bytes32 r,
    bytes32 s,
    Score calldata score
  ) internal returns (bool) {
    bytes32 scoreHash = _hashScore(score);
    bytes32 digest = ECDSA.toTypedDataHash(DOMAIN_SEPARATOR, scoreHash);

    // Recover signer from the signature
    address recoveredSigner = ECDSA.recover(digest, v, r, s);
    // Compare the recovered signer with the expected signer
    console.log("recoveredSigner: %s", recoveredSigner);
    console.log("issuer: %s", issuer);
    bool validSigner = recoveredSigner == issuer;

    // Check the nonce
    // bool validNonce = passport.nonce == recipientNonces[passport.recipient];
    // if (validNonce) {
    //   // Increment the nonce for this recipient
    //   recipientNonces[passport.recipient]++;
    // }

    // Only return true if the signer and nonce are both valid
    return validSigner;
    //  && validNonce;
  }

  // function getMultiAttestRequest(
  //   bytes32 schema,
  //   Passport calldata passport
  // ) public pure returns (MultiAttestationRequest[] memory) {
  //   MultiAttestationRequest[]
  //     memory multiAttestationRequest = new MultiAttestationRequest[](1);
  //   multiAttestationRequest[0].schema = schema;
  //   multiAttestationRequest[0].data = new AttestationRequestData[](
  //     passport.stamps.length
  //   );

  //   for (uint i = 0; i < passport.stamps.length; i++) {
  //     Stamp memory stamp = passport.stamps[i];
  //     multiAttestationRequest[0].data[i] = AttestationRequestData({
  //       recipient: passport.recipient, // The recipient of the attestation.
  //       expirationTime: 0, // The time when the attestation expires (Unix timestamp).
  //       revocable: true, // Whether the attestation is revocable.   ==> TODO: use revocable from Passport
  //       refUID: 0, // The UID of the related attestation.
  //       data: stamp.encodedData, // Custom attestation data.
  //       value: 0 // An explicit ETH amount to send to the resolver. This is important to prevent accidental user errors.
  //     });
  //   }

  //   return multiAttestationRequest;
  // }

  /**
   * @dev Adds a passport to the attester contract, verifying it using the provided signature.
   * @param schema The schema to use.
   * @param score The passport to add.
   * @param v The v component of the signature.
   * @param r The r component of the signature.
   * @param s The s component of the signature.
   */
  function addPassportWithSignature(
    bytes32 schema,
    Score calldata score,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public payable virtual {
    if (_verify(v, r, s, score) == false) {
      revert("Invalid signature");
    }

    // if (msg.value < passport.fee) {
    //   revert("Insufficient fee");
    // }

    // attester.addPassport(getMultiAttestRequest(schema, passport));
  }
}
