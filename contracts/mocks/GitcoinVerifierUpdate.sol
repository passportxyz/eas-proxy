// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import { AttestationRequest, AttestationRequestData, EAS, Attestation, MultiAttestationRequest } from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";

import "../GitcoinAttester.sol";

/**
 * @title GitcoinVerifier
 * @notice This contract is used to verify a passport's authenticity and to add a passport to the GitcoinAttester contract using the verifyAndAttest() function.
 */
contract GitcoinVerifierUpdate is UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable {
  using ECDSA for bytes32;

  // Instance of the GitcoinAttester contract
  GitcoinAttester public attester;

  // Address of the issuer of the passport
  address public issuer;

  // Domain Separator, as defined by EIP-712 (`hashstruct(eip712Domain)`)
  bytes32 private DOMAIN_SEPARATOR;

  // Name of the contract
  string public name;

  // Nonces for each recipient address
  mapping(address => uint) public recipientNonces;

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
   * @dev PassportAttestationRequest represents a signed data structure that once verified will be written to EAS.
   */
  struct PassportAttestationRequest {
    MultiAttestationRequest[] multiAttestationRequest;
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
    keccak256("AttestationRequestData(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value)");

  bytes32 private constant MULTI_ATTESTATION_REQUEST_TYPEHASH =
    keccak256("MultiAttestationRequest(bytes32 schema,AttestationRequestData[] data)AttestationRequestData(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value)");    

  // Hash type for the Passport struct
  bytes32 private constant PASSPORT_TYPEHASH =
    keccak256(
      "PassportAttestationRequest(MultiAttestationRequest[] multiAttestationRequest,uint256 nonce,uint256 fee)AttestationRequestData(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value)MultiAttestationRequest(bytes32 schema,AttestationRequestData[] data)"
    );

  /**
   * @notice Initializer function responsible for setting up the contract's initial state.
   * @param _issuer The address of the issuer of the passport.
   * @param _attester The address of the GitcoinAttester contract.
   */
  function initialize(address _issuer, address _attester) public initializer {
    __Ownable_init();
    __Pausable_init();

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

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  function _authorizeUpgrade(address) internal override onlyOwner {}

  /**
   * @notice Gets the current chain ID.
   * @return chainId The chain ID.
   */
  function _getChainId() private view returns (uint256 chainId) {
    assembly {
      chainId := chainid()
    }
  }

  function finaltest() public pure returns (uint) {
    return 0;
  }

  /**
  * @dev Hashes the provided AttestationRequestData object. This function creates 
  * a keccak256 hash from the recipient, expirationTime, revocable, refUID, data and value
  * fields of the _data object. The data field is hashed separately and included 
  * in the final hash.
  * @param _data The AttestationRequestData object that will be hashed
  * @return bytes32 The keccak256 hash of the _data
  */
  function hashAttestationRequestData(AttestationRequestData memory _data) private pure returns (bytes32) {
    return keccak256(abi.encode(
      STAMP_TYPEHASH,
      _data.recipient,
      _data.expirationTime,
      _data.revocable,
      _data.refUID,
      keccak256(_data.data),
      _data.value
    ));
  }

  /**
  * @dev Creates a hash for the provided MultiAttestationRequest object. This function 
  * hashes each AttestationRequestData item in the data array, then generates and returns 
  * a final keccak256 hash combining these hashes with the schema from the _request.
  * @param _request The MultiAttestationRequest object that will be hashed
  * @return bytes32 The keccak256 hash of the _request
  */
  function hashMultiAttestationRequest(MultiAttestationRequest memory _request) private pure returns (bytes32) {
    bytes32[] memory dataHashes = new bytes32[](_request.data.length);
    for (uint i = 0; i < _request.data.length; ) {
      dataHashes[i] = hashAttestationRequestData(_request.data[i]);
      unchecked {
        ++i;
      }
    }

    return keccak256(abi.encode(
      MULTI_ATTESTATION_REQUEST_TYPEHASH,
      _request.schema,
      keccak256(abi.encodePacked(dataHashes))
    ));
  }

  /**
  * @dev Creates a hash for the provided PassportAttestationRequest object. This function 
  * hashes each multiAttestationRequest, then generates and returns a final keccak256 hash 
  * combining these hashes with additional data from the attestationRequest.
  * @param attestationRequest The PassportAttestationRequest object that will be hashed
  * @return bytes32 The keccak256 hash of the attestationRequest
  */
  function _hashAttestations(PassportAttestationRequest calldata attestationRequest) private pure returns (bytes32) {
    bytes32[] memory multiAttestHashes = new bytes32[](attestationRequest.multiAttestationRequest.length);
    for (uint i = 0; i < attestationRequest.multiAttestationRequest.length; ) {
      multiAttestHashes[i] = hashMultiAttestationRequest(attestationRequest.multiAttestationRequest[i]);
      unchecked {
        ++i;
      }
    }

    return keccak256(abi.encode(
      PASSPORT_TYPEHASH,
      keccak256(abi.encodePacked(multiAttestHashes)),
      attestationRequest.nonce,
      attestationRequest.fee
    ));
  }

  /**
   * @dev Verifies a passport signature.
   * @param v The v component of the signature.
   * @param r The r component of the signature.
   * @param s The s component of the signature.
   * @param attestationRequest The attestation data to verify.
   */
  function _verify(
    uint8 v,
    bytes32 r,
    bytes32 s,
    PassportAttestationRequest calldata attestationRequest
  ) internal {
    // TODO: Check that all recipients are equivalent(We can currently trust this is true becuase it is being enforced when passport signs the request, but would be good to verify here as well)
    address recipient = attestationRequest.multiAttestationRequest[0].data[0].recipient;
    if (attestationRequest.nonce != recipientNonces[recipient]) {
      revert("Invalid nonce");
    }

    bytes32 attestationHash = _hashAttestations(attestationRequest);
    bytes32 digest = ECDSA.toTypedDataHash(DOMAIN_SEPARATOR, attestationHash);


    // Compare the recovered signer with the expected signer
    if (ECDSA.recover(digest, v, r, s) != issuer) {
      revert("Invalid signature");
    }

    // Increment the nonce for this recipient
    recipientNonces[recipient]++;
  }

  /**
   * @dev Adds a passport to the attester contract, verifying it using the provided signature.
   * @param attestationRequest The passport to add.
   * @param v The v component of the signature.
   * @param r The r component of the signature.
   * @param s The s component of the signature.
   */
  function verifyAndAttest(
    PassportAttestationRequest calldata attestationRequest,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public payable whenNotPaused {
    _verify(v, r, s, attestationRequest);

    if (msg.value < attestationRequest.fee) {
      revert("Insufficient fee");
    }

    attester.submitAttestations(attestationRequest.multiAttestationRequest);
  }

  /**
   * @dev Allows the contract owner to withdraw the contract's balance.
   */
  function withdrawFees() external onlyOwner {
    uint256 balance = address(this).balance;
    payable(owner()).transfer(balance);
  }
}
