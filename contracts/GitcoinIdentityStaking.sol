// SPDX-License-Identifier: GPL
pragma solidity ^0.8.23;

import {Initializable, AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {GTC} from "./mocks/GTC.sol";

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

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
  error NotOwnerOfStake();

  bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");
  bytes32 public constant RELEASER_ROLE = keccak256("RELEASER_ROLE");

  struct Stake {
    uint128 amount;
    uint128 slashedAmount;
    uint64 unlockTime;
    address owner;
    address stakee;
  }

  struct SlashingRound {
    uint192 totalSlashed; // This includes the total slashed from beginning of time
    bytes32 merkleRoot;
    bool isBurned;
    uint64 slashingTime;
  }

  // TODO func selfStakeIdsLength(address) => uint256
  mapping(address => uint256[]) public selfStakeIds;
  mapping(address => mapping(address => uint256[])) public communityStakeIds;

  mapping(uint256 stakeId => Stake) public stakes;
  uint256 public stakeCount;

  uint256 public nextSlashingRound = 0;
  uint256 public nextBurnRound = 0;

  uint64 public objectionPeriod = 90 days;

  uint256 public lastBurnTimestamp;

  address public burnAddress;

  mapping(uint256 round => SlashingRound) public slashingRounds;

  // Used to permit unfreeze
  mapping(bytes32 => bool) public slashProofHashes;

  // mapping(bytes32 => bool) public slashMerkleRoots;
  // mapping(bytes32 => bool) public slashUserMerkleRoots;

  // mapping(bytes32 => uint192) public slashTotals;

  bytes32 public slashMerkleRoot;
  // bytes32 public slashUserMerkleRoot;

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

  event SelfStakeWithdrawn(
    uint256 indexed id,
    address indexed staker,
    uint192 amount
  );

  event CommunityStakeWithdrawn(
    uint256 indexed id,
    address indexed staker,
    address indexed stakee,
    uint192 amount
  );

  event Slash(
    address indexed slasher,
    bytes32 slashProofHash,
    uint192 slashAmount
  );

  event StakeSlash(address indexed owner, uint128 slashAmount);

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

  function selfStakeMinimal(uint128 amount, uint64 duration) external {
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
    stakes[stakeId].unlockTime = unlockTime;
    stakes[stakeId].owner = msg.sender;

    if (!gtc.transferFrom(msg.sender, address(this), amount)) {
      revert FailedTransfer();
    }

    emit SelfStake(stakeId, msg.sender, amount, unlockTime);
  }

  function selfStake(uint128 amount, uint64 duration) external {
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
    stakes[stakeId].unlockTime = unlockTime;
    stakes[stakeId].owner = msg.sender;

    selfStakeIds[msg.sender].push(stakeId);

    if (!gtc.transferFrom(msg.sender, address(this), amount)) {
      revert FailedTransfer();
    }

    emit SelfStake(stakeId, msg.sender, amount, unlockTime);
  }

  function ownerOfStake(address staker, uint value) public view returns (bool) {
    uint[] memory currentStakes = selfStakeIds[staker];
    for (uint i = 0; i < currentStakes.length; i++) {
      if (currentStakes[i] == value) {
        return true;
      }
    }
    return false;
  }

  error InvalidWithdrawProof();

  function withdrawSelfStake(uint256 stakeId) external {
    require(
      stakes[stakeId].owner == msg.sender,
      "Only the owner of the stake can withdraw"
    );

    if (stakes[stakeId].unlockTime > block.timestamp) {
      revert StakeIsLocked();
    }

    // For good users this will always be zero. For bad users this will be the slash amount
    uint192 amount = stakes[stakeId].amount - stakes[stakeId].slashedAmount;

    gtc.transfer(msg.sender, amount);

    delete stakes[stakeId];

    emit SelfStakeWithdrawn(stakeId, msg.sender, amount);
  }

  function communityStake(
    address stakee,
    uint128 amount,
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

  function ownerOfCommunityStake(
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

  function withdrawCommunityStake(address stakee, uint256 stakeId) external {
    if (!ownerOfCommunityStake(msg.sender, stakee, stakeId)) {
      revert NotOwnerOfStake();
    }

    if (stakes[stakeId].unlockTime < block.timestamp) {
      revert StakeIsLocked();
    }

    uint192 amount = stakes[stakeId].amount;

    delete stakes[stakeId];

    gtc.transfer(msg.sender, amount);

    emit SelfStakeWithdrawn(stakeId, msg.sender, amount);
  }

  error InvalidSlashProof();

  function setMerkleRoot(bytes32 merkleRoot) external onlyRole(SLASHER_ROLE) {
    slashMerkleRoot = merkleRoot;
  }

  function slash(
    uint256[] calldata stakeIds,
    uint64 slashedPercent
  ) external onlyRole(SLASHER_ROLE) {
    for (uint256 i = 0; i < stakeIds.length; i++) {
      uint256 stakeId = stakeIds[i];
      uint128 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
      // totalSlashed[currentSlashRound] += slashedAmount;
      stakes[stakeId].slashedAmount += slashedAmount;
      require(
        stakes[stakeId].slashedAmount < stakes[stakeId].amount,
        "Slashed amount cannot exceed staked amount"
      );
      emit StakeSlash(stakes[stakeId].owner, stakes[stakeId].slashedAmount);
    }
  }

  function slashAndCheck(
    bytes32 _slashMerkleRoot,
    uint192 totalSlashed,
    uint256[] calldata stakeIds,
    uint128[] calldata amounts
  ) external onlyRole(SLASHER_ROLE) {
    require(
      stakeIds.length == amounts.length,
      "StakeIds and amounts must be the same length"
    );

    // Make sure the sladhed amounts are less than or equal to the staked amounts
    for (uint i = 0; i < stakeIds.length; i++) {
      uint256 stakeId = stakeIds[i];
      uint128 amountToSlash = amounts[i];
      stakes[stakeId].slashedAmount = amountToSlash;
      require(
        stakes[stakeId].amount >= amountToSlash,
        "Cannot slash more than the stake amount"
      );
    }

    uint256 slashingRound = nextSlashingRound;
    nextSlashingRound++;

    slashingRounds[slashingRound].merkleRoot = _slashMerkleRoot;
    slashingRounds[slashingRound].totalSlashed = totalSlashed;
    slashingRounds[slashingRound].slashingTime = uint64(block.timestamp);
    slashingRounds[slashingRound].isBurned = false;

    // TODO: this is redundant because it already exists in the slashingRounds mapping
    slashMerkleRoot = slashMerkleRoot;

    emit Slash(msg.sender, slashMerkleRoot, totalSlashed);
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
    // With this assert we want to make sure that the previous round has been burned
    assert(nextBurnRound == 0 || slashingRounds[nextBurnRound - 1].isBurned);

    uint256 roundThatIsBurned = nextBurnRound;
    nextBurnRound++;

    uint192 lastSlashRoundAmount = 0;

    if (roundThatIsBurned > 0) {
      // We always track the total amount ever slashed in `totalSlashed`
      // So in order to determine how much to slash this round, we need to subtract the total amount slashed from the previous round
      lastSlashRoundAmount =
        slashingRounds[roundThatIsBurned].totalSlashed -
        slashingRounds[roundThatIsBurned - 1].totalSlashed;
    }

    if (
      block.timestamp - slashingRounds[roundThatIsBurned].slashingTime <
      objectionPeriod
    ) {
      revert MinimumBurnRoundDurationNotMet();
    }
    slashingRounds[roundThatIsBurned].isBurned = true;

    uint192 amountToBurn = slashingRounds[roundThatIsBurned].totalSlashed -
      lastSlashRoundAmount;

    if (amountToBurn > 0) {
      if (!gtc.transfer(burnAddress, amountToBurn)) {
        revert FailedTransfer();
      }
    }

    emit Burn(roundThatIsBurned, amountToBurn);
  }

  // The nonce is used in the proof in case we need to
  // do the exact same slash multiple times
  function updateSlashingRound(
    uint256 slashingRound,
    bytes32 _slashMerkleRoot,
    uint192 totalSlashed
  ) external onlyRole(RELEASER_ROLE) {
    // SlashingRound memory slashingRoundToUpdate = slashingRounds[slashingRound];
    require(
      slashingRounds[slashingRound].isBurned == false,
      "Funds have already been burned for this round"
    );
    // Make sure the total slashed is not decreased
    require(
      slashingRound == 0 ||
        slashingRounds[slashingRound - 1].totalSlashed <= totalSlashed,
      "Funds have already been burned for this round"
    );

    slashingRounds[slashingRound].merkleRoot = _slashMerkleRoot;
    slashingRounds[slashingRound].totalSlashed = totalSlashed;
  }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
