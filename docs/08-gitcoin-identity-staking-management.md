# Rolling 3-24-Months Identity Staking and re-staking

This describes the contracts and state used for the rolling 3-24 months identity staking and re-staking.

## Data Structures

```solidity
// uint256 stakeCount;
uint256 stakeCount;

// mapping(selfStakerAddress => uint[]) selfStakes;
mapping(address => uint256[]) selfStakes;

// mapping(stakerAddress => mapping(stakeeAddress => uint[])) communityStakes;
mapping(address => mapping(address => uint256[])) communityStakes;

mapping(uint256 => Stake) stakes;

// mapping(stakerAddress => stakeeAddress[]) addressesStakedOnByUser;
mapping(address => address[]) addressesStakedOnByUser;

// mapping(stakeeAddress => stakerAddress[]) addressesStakingOnUser;
mapping(address => address[]) addressesStakingOnUser;

struct Stake {
  uint256 amount;
  uint64 unlockTime;
}
```

We considered using an enumerable set instead of lists to track Stake IDs. Although all operations besides writing were more efficient with an enumerable set, the difference when writing a new value/staking was considerably different, and assuming that staking would be the most common operation, we decided to use lists instead. Here is a comparison of the gas costs for each operation: https://miro.com/app/board/uXjVNFnedyI=/

## Methods

Relevant methods and their responsibilities

```solidity
function selfStake(uint256 amount, uint64 duration) external
```

- validates that duration is within duration bounds(3-24months)
- Transfers tokens from the staker to the contract.
- Creates a new `Stake` and adds it to the `stakes` mapping. `Stake` will be populated with the provided `amount` and `unlockTime` which will be block..
- Adds the `Stake` ID to the `selfStakes` mapping for the user.

```solidity
function communityStake(uint256 amount, uint64 unlockTime, address stakee) external
```

- validates that duration is within duration bounds(3-24months)
- Transfers tokens from the staker to the contract.
- Creates a new `Stake` and adds it to the `stakes` mapping. `Stake` will be populated with the provided `amount` and `unlockTime` which will be block..
- Maps the stakee and newly created Stake to the staker
- Maps stakee and staker accordingly for `addressesStakedOnByUser` and `addressesStakingOnUser` these will be used for slashing
  **Note**: Since this function involves updating 3 arrays, it might be worth while testing enumerable sets for this function.

```solidity
function unStake(uint256 stakeId) external
```

- Checks that the stake is unlocked.
- Checks that address controls the stake.
- Removes the stake from the `selfStakes` mapping for the user.
- Removes the stake from the `stakes` mapping.
- Transfers tokens from the contract to the staker.

```solidity
function communityUnStake(uint256 stakeId) external
```

- Checks that the stake is unlocked.
- Checks that address controls the stake.
- Removes the stake from the `communityStakes` mapping for the user. (Implementation)[https://github.com/OpenZeppelin/openzeppelin-contracts/blob/cffb2f1ddcd87efd68effc92cfd336c5145acabd/contracts/utils/structs/EnumerableSet.sol#L93] of efficient removal from array.
- Removes the stake from the `stakes` mapping.
- Transfers tokens from the contract to the staker.
- Removes stakee and staker accordingly for `addressesStakedOnByUser` and `addressesStakingOnUser` these will be used for slashing
  **Note**: Since this function involves updating 3 arrays, it might be worth while testing enumerable sets for this function.

```solidity
function reStake(uint256 stakeId, uint64 unlockTime) external
```

- Checks that the stake is unlocked.
- validates that unlockTime is within unlockTime bounds(3-24months) from current block timestamp
- Checks that address controls the stake.
- Updates the stake's unlock time.

```solidity
function communityReStake(uint256 stakeId, uint64 unlockTime) external
```

- Checks that the stake is unlocked.
- validates that unlockTime is within unlockTime bounds(3-24months) from current block timestamp
- Checks that address controls the stake.
- Updates the stake's unlock time.

## Description

### 3-24 month rolling stake

3-24 month rolling stake is accomplished by having a `Stake` struct that contains the amount and unlock time. The unlock time is set to the current time plus the duration of the stake.

### Re-staking

When a user wants to re-stake, the unlock time is updated to the current time plus the duration of the stake. By updating the existing stake's state by id we allow for gas efficient re-staking.

### Unstaking

Whenever possible we should remove state when unstaking user's tokens, receiving as many state refunds as possible.
