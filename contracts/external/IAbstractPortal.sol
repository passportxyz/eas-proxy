// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { AttestationPayload } from "./IAttestationRegistry.sol";

interface IAbstractPortal is IERC165 {
  function withdraw(address payable to, uint256 amount) external;

  function attestationRegistry() external view returns (address);
  function moduleRegistry() external view returns (address);
  function portalRegistry() external view returns (address);
  function router() external view returns (address);
  function modules(uint256) external view returns (address);
  function initialize(address[] calldata,address) external;

  function attest(
    AttestationPayload memory attestationPayload,
    bytes[] memory validationPayloads
  ) external payable;

  function bulkAttest(
    AttestationPayload[] memory attestationsPayloads,
    bytes[][] memory validationPayloads
  ) external payable;

  function replace(
    bytes32 attestationId,
    AttestationPayload memory attestationPayload,
    bytes[] memory validationPayloads
  ) external payable;

  function bulkReplace(
    bytes32[] memory attestationIds,
    AttestationPayload[] memory attestationsPayloads,
    bytes[][] memory validationPayloads
  ) external payable ;

  function revoke(bytes32 attestationId) external;

  function bulkRevoke(bytes32[] memory attestationIds) external;

  function getModules() external view returns (address[] memory);

  function _getAttester() external view returns (address); 

  function supportsInterface(bytes4 interfaceId) external view override returns (bool);

}
