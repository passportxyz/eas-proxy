// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract IdentityStakeGuardian {
  uint256 stakeCount;

  using EnumerableSet for EnumerableSet.UintSet;

  // Mapped array v
  EnumerableSet.UintSet selfStakeIdsSet;

  // mapping(selfStakerAddress => uint[]) stakeIds;
  mapping(address => uint256[]) selfStakeIds;

  // mapping(stakerAddress => mapping(stakeeAddress => uint[])) stakeIds;
  mapping(address => mapping(address => uint256[])) communityStakeIds;

  // mapping(stakerAddress => mapping(stakeeAddress => uint[])) stakeIds;
  mapping(address => mapping(address => EnumerableSet.UintSet)) communityStakeIdsMap;

  mapping(uint256 => Stake) stakes;

  // mapping(stakerAddress => stakeeAddress[]) addressesStakedOnByUser;
  mapping(address => address[]) addressesStakedOnByUser;

  // mapping(stakeeAddress => stakerAddress[]) addressesStakingOnUser;
  mapping(address => address[]) addressesStakingOnUser;

  bool public canStake;

  struct Stake {
    uint256 amount;
    uint256 unlockTime;
  }

  // Function to add values to communityStakeIds
  function addValuesToCommunityStakeIds(
    address staker,
    address stakee,
    uint[] memory values
  ) public {
    for (uint i = 0; i < values.length; i++) {
      communityStakeIds[staker][stakee].push(values[i]);
    }
  }

  // Function to check existence in communityStakeIds
  function existsInCommunityStakeIds(
    address staker,
    address stakee,
    uint value
  ) public view returns (bool) {
    uint[] memory stakes = communityStakeIds[staker][stakee];
    for (uint i = 0; i < stakes.length; i++) {
      if (stakes[i] == value) {
        return true;
      }
    }
    return false;
  }

  // Function to add values to communityStakeIdsMap
  function addValuesToCommunityStakeIdsMap(
    address staker,
    address stakee,
    uint[] memory values
  ) public {
    for (uint i = 0; i < values.length; i++) {
      communityStakeIdsMap[staker][stakee].add(values[i]);
    }
  }

  // Function to check existence in communityStakeIdsMap
  function existsInCommunityStakeIdsMap(
    address staker,
    address stakee,
    uint value
  ) public view returns (bool) {
    return communityStakeIdsMap[staker][stakee].contains(value);
  }

  function canUnstakeMap(
    address staker,
    address stakee,
    uint value
  ) public returns (bool) {
    if (existsInCommunityStakeIdsMap(staker, stakee, value)) {
      canStake = true;
    } else {
      canStake = false;
    }
    return true;
  }

  function canUnstake(
    address staker,
    address stakee,
    uint value
  ) public returns (bool) {
    if (existsInCommunityStakeIds(staker, stakee, value)) {
      canStake = true;
    } else {
      canStake = false;
    }
    return true;
  }
}
