// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import { IERC165Upgradeable } from "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";

import { Attestation, MultiAttestationRequest } from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";

import { IAttestationRegistry, AttestationPayload, Attestation as VeraxAttestation } from "./external/IAttestationRegistry.sol";
import { IAbstractPortal } from "./external/IAbstractPortal.sol";

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

/**
 * @title GitcoinVeraxPortal
 * @notice This is the Verax portal used with Gitcoin Passport, it accepts EAS formatted attestations and forwards them to the Verax AttestationRegistry
 */
contract GitcoinVeraxPortal is
  IAbstractPortal,
  UUPSUpgradeable,
  OwnableUpgradeable,
  PausableUpgradeable
{
  error NotAllowlisted();

  error SchemaNotMapped();

  IAttestationRegistry public veraxAttestationRegistry;

  ISchemaResolver public resolver;

  address public attester;

  mapping(address => bool) public allowlist;

  mapping(bytes32 => bytes32) public schemaMapping;

  /**
   * @notice Initializer function responsible for setting up the contract's initial state.
   * @param _attester Address to assign to attestations
   * @param _resolver Address of the schema resolver to send attestations to
   * @param _veraxAttestationRegistry Address of the Verax AttestationRegistry
   */
  function initialize(
    address _attester,
    address _resolver,
    address _veraxAttestationRegistry
  ) public initializer {
    __Ownable_init();
    __Pausable_init();

    attester = _attester;
    resolver = ISchemaResolver(_resolver);
    veraxAttestationRegistry = IAttestationRegistry(_veraxAttestationRegistry);
  }

  modifier onlyAllowlisted() {
    if (!allowlist[msg.sender]) {
      revert NotAllowlisted();
    }

    _;
  }

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address) internal override onlyOwner {}

  /**
   * @dev Adds a new schema mapping
   * @param schema The original schema ID to map from
   * @param veraxSchema The Verax schema ID to map to
   */
  function addSchemaMapping(
    bytes32 schema,
    bytes32 veraxSchema
  ) public onlyOwner {
    schemaMapping[schema] = veraxSchema;
  }

  function addToAllowlist(address _address) public onlyOwner {
    allowlist[_address] = true;
  }

  function removeFromAllowlist(address _address) public onlyOwner {
    allowlist[_address] = false;
  }

  /**
   * @dev Submits attestations to the Verax AttestationRegistry and Gitcoin Resolver
   * @param multiAttestationRequests The array of EAS-formatted MultiAttestationRequests to submit
   */
  function submitAttestations(
    MultiAttestationRequest[] calldata multiAttestationRequests
  ) public onlyAllowlisted whenNotPaused {
    uint256 numAttestations = 0;
    for (uint256 i = 0; i < multiAttestationRequests.length; ) {
      unchecked {
        numAttestations += multiAttestationRequests[i].data.length;
        i++;
      }
    }

    AttestationPayload[] memory attestationsPayloads = new AttestationPayload[](
      numAttestations
    );

    uint32 attestationId = veraxAttestationRegistry.getAttestationIdCounter() +
      1;

    bytes32[] memory attestationIds = new bytes32[](numAttestations);

    Attestation[] memory standaloneAttestations = new Attestation[](
      numAttestations
    );

    uint256 currentIndex = 0;
    for (uint256 i = 0; i < multiAttestationRequests.length; ) {
      for (uint256 j = 0; j < multiAttestationRequests[i].data.length; ) {
        bytes32 schema = schemaMapping[multiAttestationRequests[i].schema];
        if (schema == bytes32(0)) revert SchemaNotMapped();

        attestationsPayloads[currentIndex] = AttestationPayload(
          schema,
          multiAttestationRequests[i].data[j].expirationTime,
          abi.encodePacked(multiAttestationRequests[i].data[j].recipient),
          multiAttestationRequests[i].data[j].data
        );

        attestationIds[currentIndex] = bytes32(abi.encode(attestationId));

        standaloneAttestations[currentIndex]
          .recipient = multiAttestationRequests[i].data[j].recipient;
        standaloneAttestations[currentIndex].uid = attestationIds[currentIndex];
        standaloneAttestations[currentIndex].schema = schema;
        standaloneAttestations[currentIndex].attester = address(attester);

        unchecked {
          j++;
          currentIndex++;
          attestationId++;
        }
      }
      unchecked {
        i++;
      }
    }

    veraxAttestationRegistry.bulkAttest(
      attestationsPayloads,
      address(attester)
    );

    resolver.multiAttest(standaloneAttestations, new uint256[](0));
  }

  /**
   * @dev Gets an attestation from the Verax AttestationRegistry, returns it in the EAS format
   * @param uid The UID of the attestation to get
   * @return Attestation The EAS-formatted attestation
   */
  function getAttestation(
    bytes32 uid
  ) public view returns (Attestation memory) {
    VeraxAttestation memory veraxAttestation = veraxAttestationRegistry
      .getAttestation(uid);

    Attestation memory convertedAttestation = Attestation(
      veraxAttestation.attestationId,
      veraxAttestation.schemaId,
      veraxAttestation.attestedDate,
      veraxAttestation.expirationDate,
      veraxAttestation.revocationDate,
      "",
      address(uint160(bytes20(veraxAttestation.subject))),
      veraxAttestation.attester,
      true,
      veraxAttestation.attestationData
    );

    return convertedAttestation;
  }

  function supportsInterface(
    bytes4 interfaceID
  ) public pure virtual override returns (bool) {
    return
      interfaceID == type(IAbstractPortal).interfaceId ||
      interfaceID == type(IERC165Upgradeable).interfaceId;
  }

  function getModules() external pure returns (address[] memory) {
    return new address[](0);
  }

  function _getAttester() external view returns (address) {
    return address(attester);
  }

  function attestationRegistry() external view returns (address) {
    return address(veraxAttestationRegistry);
  }

  /* solhint-disable no-empty-blocks */
  function attest(
    AttestationPayload memory /* attestationPayload */,
    bytes[] memory /* validationPayloads */
  ) external payable {}

  function bulkAttest(
    AttestationPayload[] memory /* attestationsPayloads */,
    bytes[][] memory /* validationPayloads */
  ) external payable {}

  function replace(
    bytes32 /* attestationId */,
    AttestationPayload memory /* attestationPayload */,
    bytes[] memory /* validationPayloads */
  ) external payable {}

  function bulkReplace(
    bytes32[] memory /* attestationIds */,
    AttestationPayload[] memory /* attestationsPayloads */,
    bytes[][] memory /* validationPayloads */
  ) external payable {}

  function revoke(bytes32 /* attestationId */) external pure {}

  function bulkRevoke(bytes32[] memory /* attestationIds */) external pure {}

  function withdraw(
    address payable /* to */,
    uint256 /* amount */
  ) external pure {}

  function moduleRegistry() external pure returns (address) {}

  function portalRegistry() external pure returns (address) {}

  function router() external pure returns (address) {}

  function modules(uint256) external pure returns (address) {}

  function initialize(
    address[] calldata /* _modules */,
    address /* _router */
  ) public {}

  /* solhint-enable no-empty-blocks */
}
