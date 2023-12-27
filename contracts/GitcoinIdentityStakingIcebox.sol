// SPDX-License-Identifier: GPL
pragma solidity ^0.8.23;

import {Initializable, AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title GitcoinIdentityStakingIcebox
 * @notice This contract is used to temporarily store slashed stake
 */

contract GitcoinIdentityStakingIcebox is
  Initializable,
  UUPSUpgradeable,
  AccessControlUpgradeable,
  PausableUpgradeable
{
  bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

  error OnlyManager();
  error OnlyAdmin();

  constructor() {
    // Grant the minter role to a specified account
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
