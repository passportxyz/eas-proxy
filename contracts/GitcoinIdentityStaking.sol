// SPDX-License-Identifier: GPL
pragma solidity ^0.8.23;

import {Initializable, AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {GTC} from "./mocks/GTC.sol";

import "hardhat/console.sol";

/**
 * @title GitcoinIdentityStaking
 * @notice This contract is used to stake GTC on self/community identity
 */

// Control
contract GitcoinIdentityStaking is
  Initializable,
  UUPSUpgradeable,
  AccessControlUpgradeable,
  PausableUpgradeable
{
  using EnumerableSet for EnumerableSet.AddressSet;

  error SlashProofHashNotFound();
  error SlashProofHashNotValid();
  error SlashProofHashAlreadyUsed();
  error FundsNotAvailableToRelease();
  error MinimumBurnRoundDurationNotMet();
  error AmountMustBeGreaterThanZero();
  error UnlockTimeMustBeInTheFuture();
  error CannotStakeOnSelf();
  error FailedTransfer();
  error InvalidLockTime();
  error StakeIsLocked();

  bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");
  bytes32 public constant RELEASER_ROLE = keccak256("RELEASER_ROLE");

  struct Stake {
    uint192 amount;
    uint64 unlockTime;
  }

  // TODO func selfStakeIdsLength(address) => uint256
  mapping(address => uint256[]) public selfStakeIds;
  mapping(address => mapping(address => uint256[])) public communityStakeIds;

  mapping(uint256 stakeId => Stake) public stakes;
  uint256 public stakeCount;

  uint256 public currentSlashRound = 1;

  uint64 public burnRoundMinimumDuration = 90 days;

  uint256 public lastBurnTimestamp;

  address public burnAddress;

  mapping(uint256 round => uint192 amount) public totalSlashed;

  // Used to permit unfreeze
  mapping(bytes32 => bool) public slashProofHashes;

  event SelfStake(
    uint256 indexed id,
    address indexed staker,
    uint192 amount,
    uint64 unlockTime
  );

  event CommunityStake(
    uint256 indexed id,
    address indexed staker,
    address indexed stakee,
    uint192 amount,
    uint64 unlockTime
  );

  event Slash(
    address indexed slasher,
    uint64 slashedPercent,
    bytes32 slashProofHash
  );

  event Burn(uint256 indexed round, uint192 amount);

  GTC public gtc;

  function initialize(
    address gtcAddress,
    address _burnAddress
  ) public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();

    gtc = GTC(gtcAddress);
    burnAddress = _burnAddress;

    lastBurnTimestamp = block.timestamp;
  }

  function selfStake(uint192 amount, uint64 duration) external {
    // revert if amount is 0. Since this value is unsigned integer
    if (amount == 0) {
      revert AmountMustBeGreaterThanZero();
    }

    uint64 unlockTime = duration + uint64(block.timestamp);

    if (
      unlockTime < block.timestamp + 12 weeks ||
      unlockTime > block.timestamp + 104 weeks
    ) {
      revert InvalidLockTime();
    }

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    // double check conversion
    stakes[stakeId].unlockTime = unlockTime;

    selfStakeIds[msg.sender].push(stakeId);

    if (!gtc.transferFrom(msg.sender, address(this), amount)) {
      revert FailedTransfer();
    }

    emit SelfStake(stakeId, msg.sender, amount, unlockTime);
  }

  function withdrawSelfStake(uint256 stakeId) external {
    if (stakes[stakeId].unlockTime < block.timestamp) {
      revert StakeIsLocked();
    }

    uint192 amount = stakes[stakeId].amount;

    delete stakes[stakeId];

    gtc.transfer(msg.sender, amount);
  }

  function communityStake(
    address stakee,
    uint192 amount,
    uint64 duration
  ) external {
    if (stakee == msg.sender) {
      revert CannotStakeOnSelf();
    }
    if (amount == 0) {
      revert AmountMustBeGreaterThanZero();
    }

    uint64 unlockTime = duration + uint64(block.timestamp);

    if (
      unlockTime < block.timestamp + 12 weeks ||
      unlockTime > block.timestamp + 104 weeks
    ) {
      revert InvalidLockTime();
    }

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = uint64(unlockTime);

    communityStakeIds[msg.sender][stakee].push(stakeId);

    if (!gtc.transferFrom(msg.sender, address(this), amount)) {
      revert FailedTransfer();
    }

    emit CommunityStake(stakeId, msg.sender, stakee, amount, unlockTime);
  }

  function slash(
    uint256[] calldata stakeIds,
    uint64 slashedPercent,
    bytes32 slashProofHash
  ) external onlyRole(SLASHER_ROLE) {
    if (slashProofHashes[slashProofHash]) {
      revert SlashProofHashAlreadyUsed();
    }

    uint256 numStakes = stakeIds.length;

    for (uint256 i = 0; i < numStakes; i++) {
      uint256 stakeId = stakeIds[i];
      uint192 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
      totalSlashed[currentSlashRound] += slashedAmount;
      stakes[stakeId].amount -= slashedAmount;
    }

    slashProofHashes[slashProofHash] = true;

    emit Slash(msg.sender, slashedPercent, slashProofHash);
  }

  // Burn last round and start next round (locking this round)
  //
  // Rounds don't matter for staking, this is just to
  // ensure that slashes are aged before being burned
  //
  // On each call...
  // - the current round contains all the slashes younger than the last
  //   burn (a minimum of the round mimimum duration, 0-90 days)
  // - the previous round contains all the non-released slashes older
  //   than this (at least 90 days), and so it is burned
  // - the current round becomes the previous round, and a new round
  //   is initiated
  // On the very first call, nothing will be burned
  function burn() external {
    if (block.timestamp - lastBurnTimestamp < burnRoundMinimumDuration) {
      revert MinimumBurnRoundDurationNotMet();
    }

    uint192 amountToBurn = totalSlashed[currentSlashRound - 1];

    if (amountToBurn > 0) {
      if (!gtc.transfer(burnAddress, amountToBurn)) {
        revert FailedTransfer();
      }
    }

    emit Burn(currentSlashRound - 1, amountToBurn);

    currentSlashRound++;
    lastBurnTimestamp = block.timestamp;
  }

  struct SlashMember {
    address account;
    uint192 amount;
  }

  // The nonce is used in the proof in case we need to
  // do the exact same slash multiple times
  function release(
    SlashMember[] calldata slashMembers,
    uint256 slashMemberIndex,
    uint192 amountToRelease,
    bytes32 slashProofHash,
    bytes32 nonce,
    bytes32 newNonce
  ) external onlyRole(RELEASER_ROLE) {
    if (!slashProofHashes[slashProofHash]) {
      revert SlashProofHashNotFound();
    }
    if (keccak256(abi.encode(slashMembers, nonce)) != slashProofHash) {
      revert SlashProofHashNotValid();
    }

    SlashMember memory slashMemberToRelease = slashMembers[slashMemberIndex];

    if (amountToRelease > slashMemberToRelease.amount) {
      revert FundsNotAvailableToRelease();
    }

    SlashMember[] memory newSlashMembers = slashMembers;

    newSlashMembers[slashMemberIndex].amount -= amountToRelease;

    bytes32 newSlashProofHash = keccak256(
      abi.encode(newSlashMembers, newNonce)
    );

    slashProofHashes[slashProofHash] = false;
    slashProofHashes[newSlashProofHash] = true;

    if (!gtc.transfer(slashMemberToRelease.account, amountToRelease)) {
      revert FailedTransfer();
    }
  }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
