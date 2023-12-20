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

  bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");
  bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
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

  uint256 public currentBurnRound = 1;

  mapping(uint256 round => uint192 amount) public totalSlashed;

  // Used to permit unfreeze
  mapping(bytes32 => bool) public slashProofHashes;

  event SelfStake(address indexed staker, uint192 amount);

  event CommunityStake(
    address indexed staker,
    address indexed stakee,
    uint192 amount
  );

  event Slash(
    address indexed slasher,
    uint64 slashedPercent,
    bytes32 slashProofHash
  );

  event Burn(uint256 indexed round, uint192 amount);

  GTC public gtc;

  function initialize(address gtcAddress) public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();

    gtc = GTC(gtcAddress);
  }

  function selfStake(uint192 amount, uint64 unlockTime) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;

    gtc.transferFrom(msg.sender, address(this), amount);

    selfStakeIds[msg.sender].push(stakeId);

    emit SelfStake(msg.sender, amount);
  }

  function communityStake(
    address stakee,
    uint192 amount,
    uint64 unlockTime
  ) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;

    communityStakeIds[msg.sender][stakee].push(stakeId);

    gtc.transferFrom(msg.sender, address(this), amount);

    emit CommunityStake(msg.sender, stakee, amount);
  }

  function slash(
    uint256[] calldata stakeIds,
    uint64 slashedPercent,
    bytes32 slashProofHash
  ) external onlyRole(SLASHER_ROLE) {
    uint256 numStakes = stakeIds.length;

    for (uint256 i = 0; i < numStakes; i++) {
      uint256 stakeId = stakeIds[i];
      uint192 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
      totalSlashed[currentBurnRound] += slashedAmount;
      stakes[stakeId].amount -= slashedAmount;
    }

    slashProofHashes[slashProofHash] = true;

    emit Slash(msg.sender, slashedPercent, slashProofHash);
  }

  // Burn last round, start next round (locking this round)
  // Rounds don't matter, this is just to time the slashing
  function burn() external onlyRole(BURNER_ROLE) {
    // TODO check that threshold has passed since last burn, save this timestamp

    gtc.transfer(address(1), totalSlashed[currentBurnRound - 1]);

    emit Burn(currentBurnRound - 1, totalSlashed[currentBurnRound - 1]);

    currentBurnRound++;
  }

  struct SlashMember {
    address account;
    uint192 amount;
  }

  // Pseudocode
  function release(
    SlashMember[] calldata slashMembers,
    uint256 slashMemberIndex,
    uint192 amountToRelease,
    bytes32 slashProofHash
  ) external onlyRole(RELEASER_ROLE) {
    require(slashProofHashes[slashProofHash], "Slash proof hash not found");
    require(keccak256(abi.encode(slashMembers)) == slashProofHash, "Slash proof hash does not match");

    SlashMember memory slashMemberToRelease = slashMembers[slashMemberIndex];

    require(amountToRelease <= slashMemberToRelease.amount, "Amount to release must be less than or equal to amount slashed");

    SlashMember[] memory newSlashMembers = slashMembers;

    newSlashMembers[slashMemberIndex].amount -= amountToRelease;

    bytes32 newSlashProofHash = keccak256(abi.encode(newSlashMembers));

    slashProofHashes[slashProofHash] = false;
    slashProofHashes[newSlashProofHash] = true;

    gtc.transfer(slashMemberToRelease.account, amountToRelease);
  }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
