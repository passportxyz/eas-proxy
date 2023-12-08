// SPDX-License-Identifier: GPL
pragma solidity ^0.8.23;

import {Initializable, AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import "hardhat/console.sol";

/**
 * @title GitcoinIdentityStaking
 * @notice This contract is used to stake GTC on self/community identity
 */

contract GitcoinIdentityStaking is
  Initializable,
  UUPSUpgradeable,
  AccessControlUpgradeable,
  PausableUpgradeable
{
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

  error OnlySlasher();
  error OnlyAdmin();

  struct Stake {
    uint256 amount;
    uint64 unlockTime;
  }

  uint256 public stakeCount;
  mapping(address => uint256[]) public selfStakeIds;
  mapping(address => mapping(address => uint256[])) public communityStakeIds;
  mapping(address => EnumerableSet.AddressSet) private communityStakersForAddress;
  mapping(address => EnumerableSet.AddressSet) private communityStakeesForAddress;

  mapping(uint256 => Stake) public stakes;

  uint256 public incrementToReset;

  // season# => amount
  mapping(uint256 => uint256) public totalSlashed;

  mapping(uint256 => bool) public slashHashes;

  function initialize() public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();
  }

  function selfStake(uint256 amount, uint64 unlockTime) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;
    selfStakeIds[msg.sender].push(stakeId);
  }

  function communityStake(address stakee, uint256 amount, uint64 unlockTime) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;

    communityStakeIds[msg.sender][stakee].push(stakeId);

    communityStakeesForAddress[msg.sender].add(stakee);
    communityStakersForAddress[stakee].add(msg.sender);
  }

  function slash(address[] calldata accounts, uint64 slashedPercent, uint256 slashHash) external {
    uint256 numAccounts = accounts.length;

    for (uint256 j = 0; j < numAccounts; j++) {
      address account = accounts[j];
      uint256 numSelfStakes = selfStakeIds[account].length;
      for (uint256 i = 0; i < numSelfStakes; i++) {
        uint256 stakeId = selfStakeIds[account][i];
        uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
        totalSlashed[incrementToReset] += slashedAmount;
        stakes[stakeId].amount -= slashedAmount;
      }

      uint256 numStakedOnByMe = communityStakeesForAddress[account].length();
      for (uint256 i = 0; i < numStakedOnByMe; i++) {
        address stakee = communityStakeesForAddress[account].at(i);
        uint256 numStakes = communityStakeIds[account][stakee].length;
        for (uint256 i = 0; i < numStakes; i++) {
          uint256 stakeId = communityStakeIds[account][stakee][i];
          uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
          totalSlashed[incrementToReset] += slashedAmount;
          stakes[stakeId].amount -= slashedAmount;
        }
      }

      uint256 numOthersStakingMe = communityStakersForAddress[account].length();
      for (uint256 i = 0; i < numOthersStakingMe; i++) {
        address staker = communityStakersForAddress[account].at(i);
        uint256 numStakes = communityStakeIds[staker][account].length;
        for (uint256 i = 0; i < numStakes; i++) {
          uint256 stakeId = communityStakeIds[staker][account][i];
          uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
          totalSlashed[incrementToReset] += slashedAmount;
          stakes[stakeId].amount -= slashedAmount;
        }
      }
    }

    slashHashes[slashHash] = true;
  }

  function burn() external {
    // TODO check that threshold has passed since last burn, save this timestamp
    incrementToReset++;
  }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

contract GitcoinIdentityStaking2 is
  Initializable,
  UUPSUpgradeable,
  AccessControlUpgradeable,
  PausableUpgradeable
{
  bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

  error OnlySlasher();
  error OnlyAdmin();

  struct Stake {
    uint256 amount;
    uint64 unlockTime;
    uint64 slashedPercent;
    uint64 slashedTime;
  }

  mapping(address => uint256[]) public selfStakeIds;
  mapping(uint256 => Stake) public stakes;
  uint256 public stakeCount;
  uint256[] public slashed;

  function initialize() public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();
  }

  function selfStake(uint256 amount, uint64 unlockTime) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;

    selfStakeIds[msg.sender].push(stakeId);
  }

  // NOTE don't allow increasing stake amount for a stake that has slashedPercent > 0

  function slash(address[] calldata accounts, uint64 slashedPercent) external {
    uint256 numAccounts = accounts.length;
    for (uint256 j = 0; j < numAccounts; j++) {
      address account = accounts[j];
      uint256 numStakes = selfStakeIds[account].length;
      for (uint256 i = 0; i < numStakes; i++) {
        uint256 stakeId = selfStakeIds[account][i];
        uint64 newSlashedPercent = 100 -
          ((100 - slashedPercent) * (100 - stakes[stakeId].slashedPercent)) /
          100;
        stakes[stakeId].slashedPercent = newSlashedPercent;
        stakes[stakeId].slashedTime = uint64(block.timestamp);
        slashed.push(stakeId);
      }
    }
  }

  function burn() external {
    uint256 numSlashed = slashed.length;
    for (uint256 i = 0; i < numSlashed; i++) {
      if (stakes[slashed[i]].slashedTime > 0) {
        uint256 stakeId = slashed[i];
        uint256 slashedAmount = (stakes[stakeId].slashedPercent *
          stakes[stakeId].amount) / 100;
        stakes[stakeId].amount -= slashedAmount;
      }
    }
    slashed = new uint256[](0);
  }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

contract GitcoinIdentityStaking3 is
  Initializable,
  UUPSUpgradeable,
  AccessControlUpgradeable,
  PausableUpgradeable
{
  bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

  error OnlySlasher();
  error OnlyAdmin();

  struct Stake {
    uint256 amount;
    uint64 unlockTime;
  }

  struct Slash {
    uint64 slashedPercent;
    uint64 slashedTime;
  }

  mapping(address => uint256[]) public selfStakeIds;
  mapping(uint256 => Stake) public stakes;
  mapping(uint256 => Slash) public slashes;
  uint256 public stakeCount;

  function initialize() public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();
  }

  function selfStake(uint256 amount, uint64 unlockTime) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;

    selfStakeIds[msg.sender].push(stakeId);
  }

  // NOTE don't allow increasing stake amount for a stake that has slashedPercent > 0

  function slash(address[] calldata accounts, uint64 slashedPercent) external {
    uint256 numAccounts = accounts.length;
    for (uint256 j = 0; j < numAccounts; j++) {
      address account = accounts[j];
      uint256 numStakes = selfStakeIds[account].length;
      for (uint256 i = 0; i < numStakes; i++) {
        uint256 stakeId = selfStakeIds[account][i];
        uint64 newSlashedPercent = 100 -
          ((100 - slashedPercent) * (100 - slashes[stakeId].slashedPercent)) /
          100;
        slashes[stakeId].slashedPercent = newSlashedPercent;
        slashes[stakeId].slashedTime = uint64(block.timestamp);
      }
    }
  }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

  function burn(uint256[] calldata ids) external {
    uint256 numIds = ids.length;
    for (uint256 i = 0; i < numIds; i++) {
      if (slashes[ids[i]].slashedTime > 0) {
        uint256 stakeId = ids[i];
        uint256 slashedAmount = (slashes[stakeId].slashedPercent *
          stakes[stakeId].amount) / 100;
        stakes[stakeId].amount -= slashedAmount;
      }
    }
  }
}
