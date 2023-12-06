// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "hardhat/console.sol";

contract IdentityStakeGuardian {
  uint256 stakeCount;

  using EnumerableSet for EnumerableSet.UintSet;

  // Mapped array v
  EnumerableSet.UintSet selfStakeIdsSet;

  // mapping(selfStakerAddress => uint[]) stakeIds;
  mapping(address => uint256[]) selfStakeIds;

  // mapping(selfStakerAddress => uint[]) stakeIds;
  mapping(address => EnumerableSet.UintSet) selfStakeIdsMap;

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

  uint public activeStake;

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
    uint[] memory currentStakes = communityStakeIds[staker][stakee];
    for (uint i = 0; i < currentStakes.length; i++) {
      if (currentStakes[i] == value) {
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

  // Function to add values to communityStakeIdsMap
  function addValuesToSelfStakeIdsMap(
    address staker,
    uint[] memory stakeIds
  ) public {
    for (uint i = 0; i < stakeIds.length; i++) {
      selfStakeIdsMap[staker].add(stakeIds[i]);
    }
  }

  function addSelfStakeMap(address user, Stake memory stake) public {
    // Validate inputs

    stakeCount += 1;
    uint256 stakeId = stakeCount;

    stakes[stakeId] = stake;

    selfStakeIdsMap[user].add(stakeId);
  }

  function addSelfStake(address user, Stake memory stake) public {
    // Validate inputs

    stakeCount += 1;
    uint256 stakeId = stakeCount;

    stakes[stakeId] = stake;

    selfStakeIds[user].push(stakeId);
  }

  // Function to check existence in communityStakeIdsMap
  function existsInCommunityStakeIdsMap(
    address staker,
    address stakee,
    uint stakeId
  ) public view returns (bool) {
    return communityStakeIdsMap[staker][stakee].contains(stakeId);
  }

  function listLookupMap(
    address staker,
    address stakee,
    uint stakeId
  ) public returns (bool) {
    if (existsInCommunityStakeIdsMap(staker, stakee, stakeId)) {
      canStake = true;
    } else {
      canStake = false;
    }
    return true;
  }

  function listLookup(
    address staker,
    address stakee,
    uint stakeId
  ) public returns (bool) {
    if (existsInCommunityStakeIds(staker, stakee, stakeId)) {
      canStake = true;
    } else {
      canStake = false;
    }
    return true;
  }

  // A variation of this will need to occur for the following functions
  function sumActiveSelfStake(address user) public returns (uint) {
    // Get user's Stake Ids (Set or Array)
    uint256 userStake = 0;
    uint256 selfStakeIdsLength = selfStakeIds[user].length;
    for (uint256 i = 0; i < selfStakeIdsLength; ++i) {
      userStake += stakes[selfStakeIds[user][i]].amount;
    }

    // Aggregate total active stake

    // Return total active stake
    activeStake = userStake;
  }

  function removeItemFromSelfStakeIdsMap(
    address user,
    uint stakeId
  ) public returns (bool) {
    selfStakeIdsMap[user].remove(stakeId);
    canStake = true;
    return true;
  }

  function removeItemFromSelfIds(
    address user,
    uint stakeId
  ) public returns (bool) {
    uint256 selfStakeIdsLength = selfStakeIds[user].length;
    for (uint256 i = 0; i < selfStakeIdsLength; ++i) {
      if (selfStakeIds[user][i] == stakeId) {
        uint256 lastValue = selfStakeIds[user][selfStakeIdsLength - 1];

        uint256 toDeleteValue = selfStakeIds[user][i];

        selfStakeIds[user][selfStakeIdsLength - 1] = toDeleteValue;

        selfStakeIds[user][i] = lastValue;

        selfStakeIds[user].pop();

        console.log("finished");
        break;
      }
    }

    canStake = true;
    return true;
  }

  function sumActiveSelfStakeMap(address user) public {
    // Get user's Stake Ids (Set or Array)
    uint256 userStake = 0;
    uint256 selfStakeIdsLength = selfStakeIdsMap[user].length();
    for (uint256 i = 0; i < selfStakeIdsLength; ++i) {
      userStake += stakes[selfStakeIdsMap[user].at(i)].amount;
    }

    // Aggregate total active stake

    // Return total active stake
    activeStake = userStake;
  }

  function getActiveSelfStake(address user) public view returns (uint) {
    // Get user's Stake Ids (Set or Array)

    // Aggregate total active stake

    // Return total active stake
    return activeStake;
  }

  function getRestakableSelfStake(address user) public view returns (uint) {
    // Get user's Stake Ids (Set or Array)

    // Aggregate total active stake that is not locked

    // Return total restakable stake
    return activeStake;
  }
}
