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

  error OnlySlasher();
  error OnlyAdmin();

  struct Stake {
    uint256 amount;
    uint64 unlockTime;
  }

  mapping(address => uint256[]) public selfStakeIds;
  mapping(address => mapping(address => uint256[])) public communityStakeIds;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakersForAddress;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakeesForAddress;

  mapping(uint256 stakeId => Stake) public stakes;
  uint256 public stakeCount;

  uint256 public currentBurnRound = 1;

  mapping(uint256 round => uint256 amount) public totalSlashed;

  // Used to permit unfreeze
  mapping(uint256 => bool) public slashProofHashes;

  event SelfStake(address indexed staker, uint256 amount);
  event CommunityStake(
    address indexed staker,
    address indexed stakee,
    uint256 amount
  );

  event SlashEvent(
    address indexed slasher,
    uint64 slashedPercent,
    uint256 slashProofHash
  );

  event Burn(uint256 indexed round, uint256 amount);

  GTC public gtc;

  function initialize(address gtcAddress) public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();

    gtc = GTC(gtcAddress);
  }

  function selfStake(uint256 amount, uint64 unlockTime) external {
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
    uint256 amount,
    uint64 unlockTime
  ) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;

    communityStakeIds[msg.sender][stakee].push(stakeId);

    gtc.transferFrom(msg.sender, address(this), amount);

    communityStakeesForAddress[msg.sender].add(stakee);
    communityStakersForAddress[stakee].add(msg.sender);

    emit CommunityStake(msg.sender, stakee, amount);
  }

  function slash(
    address[] calldata accounts,
    uint64 slashedPercent,
    uint256 slashProofHash
  ) external {
    uint256 numAccounts = accounts.length;

    for (uint256 i = 0; i < numAccounts; i++) {
      address account = accounts[i];
      uint256 numSelfStakes = selfStakeIds[account].length;
      for (uint256 j = 0; j < numSelfStakes; j++) {
        uint256 stakeId = selfStakeIds[account][j];
        uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
        totalSlashed[currentBurnRound] += slashedAmount;
        stakes[stakeId].amount -= slashedAmount;
      }

      uint256 numStakedOnByMe = communityStakeesForAddress[account].length();
      for (uint256 j = 0; j < numStakedOnByMe; j++) {
        address stakee = communityStakeesForAddress[account].at(j);
        uint256 numStakes = communityStakeIds[account][stakee].length;
        for (uint256 k = 0; k < numStakes; k++) {
          uint256 stakeId = communityStakeIds[account][stakee][k];
          uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) /
            100;
          totalSlashed[currentBurnRound] += slashedAmount;
          stakes[stakeId].amount -= slashedAmount;
        }
      }

      uint256 numOthersStakingMe = communityStakersForAddress[account].length();
      for (uint256 j = 0; j < numOthersStakingMe; j++) {
        address staker = communityStakersForAddress[account].at(j);
        uint256 numStakes = communityStakeIds[staker][account].length;
        for (uint256 k = 0; k < numStakes; k++) {
          uint256 stakeId = communityStakeIds[staker][account][k];
          uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) /
            100;
          totalSlashed[currentBurnRound] += slashedAmount;
          stakes[stakeId].amount -= slashedAmount;
        }
      }
    }

    slashProofHashes[slashProofHash] = true;

    emit SlashEvent(msg.sender, slashedPercent, slashProofHash);
  }

  // Burn last round, start next round (locking this round)
  // Rounds don't matter, this is just to time the slashing
  function burn() external {
    // TODO check that threshold has passed since last burn, save this timestamp

    gtc.transfer(address(1), totalSlashed[currentBurnRound - 1]);

    emit Burn(currentBurnRound - 1, totalSlashed[currentBurnRound - 1]);

    currentBurnRound++;
  }

  // Pseudocode
  // function release(address, amount, proof, slashProofHash) external {
  //   require(msg.sender has Releaser role)
  //   require(slashProofHashes[slashProofHash], "Slash proof hash not found");
  //   checkProof(proof, slashProofHash); // Probably merkle membership?
  //   // release
  // }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

// Tracking slashes explicitly in contract
contract GitcoinIdentityStaking2 is
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

  struct Slash {
    uint256 amount;
    uint64 time;
    address[] accounts;
  }

  mapping(address => uint256[]) public selfStakeIds;
  mapping(address => mapping(address => uint256[])) public communityStakeIds;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakersForAddress;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakeesForAddress;

  mapping(uint256 stakeId => Stake) public stakes;
  mapping(uint256 slashId => Slash) public slashes;
  uint256 public stakeCount;
  uint256 public slashCount;

  event SelfStake(address indexed staker, uint256 amount);
  event CommunityStake(
    address indexed staker,
    address indexed stakee,
    uint256 amount
  );

  event SlashEvent(
    address indexed slasher,
    uint64 slashedPercent,
    uint256 slashCount
  );

  event Burn(address indexed burner);

  GTC public gtc;

  function initialize(address gtcAddress) public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();

    gtc = GTC(gtcAddress);
  }

  function selfStake(uint256 amount, uint64 unlockTime) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;

    selfStakeIds[msg.sender].push(stakeId);

    gtc.transferFrom(msg.sender, address(this), amount);

    emit SelfStake(msg.sender, amount);
  }

  function communityStake(
    address stakee,
    uint256 amount,
    uint64 unlockTime
  ) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;

    communityStakeIds[msg.sender][stakee].push(stakeId);

    communityStakeesForAddress[msg.sender].add(stakee);
    communityStakersForAddress[stakee].add(msg.sender);

    gtc.transferFrom(msg.sender, address(this), amount);

    emit CommunityStake(msg.sender, stakee, amount);
  }

  function slash(address[] calldata accounts, uint64 slashedPercent) external {
    uint256 totalSlashed = 0;
    uint256 numAccounts = accounts.length;
    for (uint256 i = 0; i < numAccounts; i++) {
      address account = accounts[i];
      uint256 selfStakeCount = selfStakeIds[account].length;
      for (uint256 j = 0; j < selfStakeCount; j++) {
        uint256 stakeId = selfStakeIds[account][j];
        uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
        stakes[stakeId].amount -= slashedAmount;
        totalSlashed += slashedAmount;
      }

      uint256 numStakedOnByMe = communityStakeesForAddress[account].length();
      for (uint256 j = 0; j < numStakedOnByMe; j++) {
        address stakee = communityStakeesForAddress[account].at(j);
        uint256 numStakes = communityStakeIds[account][stakee].length;
        for (uint256 k = 0; k < numStakes; k++) {
          uint256 stakeId = communityStakeIds[account][stakee][k];
          uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) /
            100;
          stakes[stakeId].amount -= slashedAmount;
          totalSlashed += slashedAmount;
        }
      }

      uint256 numOthersStakingMe = communityStakersForAddress[account].length();
      for (uint256 j = 0; j < numOthersStakingMe; j++) {
        address staker = communityStakersForAddress[account].at(j);
        uint256 numStakes = communityStakeIds[staker][account].length;
        for (uint256 k = 0; k < numStakes; k++) {
          uint256 stakeId = communityStakeIds[staker][account][k];
          uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) /
            100;
          stakes[stakeId].amount -= slashedAmount;
          totalSlashed += slashedAmount;
        }
      }
    }

    slashes[slashCount].amount = totalSlashed;
    slashes[slashCount].time = uint64(block.timestamp);
    slashes[slashCount].accounts = accounts;

    slashCount++;

    emit SlashEvent(msg.sender, slashedPercent, slashCount);
  }

  function burn(uint256[] calldata slashIds) external {
    uint256 amountToBurn = 0;

    uint256 numIds = slashIds.length;
    for (uint256 i = 0; i < numIds; i++) {
      uint256 slashId = slashIds[i];
      if (slashes[slashId].time > 0) {
        amountToBurn += slashes[slashId].amount;
      }

      delete slashes[slashId];
    }

    gtc.transfer(address(1), uint256(amountToBurn));

    emit Burn(msg.sender);
  }

  // Pseudocode
  // function release(address, amount, slashId) external {
  //   require(msg.sender has Releaser role)
  //   require(slashed[slashId] exists)
  //   require(slashes[slashId].accounts.contains(address))
  //   // release
  // }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

// Track slashes explicitly, move gas usage to burn
contract GitcoinIdentityStaking3 is
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

  struct Slash {
    uint64 percent;
    uint64 time;
    address[] accounts;
  }

  mapping(address => uint256[]) public selfStakeIds;
  mapping(address => mapping(address => uint256[])) public communityStakeIds;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakersForAddress;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakeesForAddress;

  mapping(uint256 stakeId => Stake) public stakes;
  mapping(uint256 slashId => Slash) public slashes;
  uint256 public stakeCount;
  uint256 public slashCount;

  event SelfStake(address indexed staker, uint256 amount);
  event CommunityStake(
    address indexed staker,
    address indexed stakee,
    uint256 amount
  );

  event SlashEvent(
    address indexed slasher,
    uint64 slashedPercent,
    uint256 slashCount
  );

  event Burn(address indexed burner);

  GTC public gtc;

  function initialize(address gtcAddress) public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();

    gtc = GTC(gtcAddress);
  }

  // For this one, getting self and community stake totals is
  // WAY more complex, all the slashing calculations from the
  // `burn` function must be executed for **any** read. But
  // if we don't need to ever read this data as part of a
  // transaction, that's fine

  function selfStake(uint256 amount, uint64 unlockTime) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;

    selfStakeIds[msg.sender].push(stakeId);

    gtc.transferFrom(msg.sender, address(this), amount);

    emit SelfStake(msg.sender, amount);
  }

  function communityStake(
    address stakee,
    uint256 amount,
    uint64 unlockTime
  ) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;

    communityStakeIds[msg.sender][stakee].push(stakeId);

    communityStakeesForAddress[msg.sender].add(stakee);
    communityStakersForAddress[stakee].add(msg.sender);

    gtc.transferFrom(msg.sender, address(this), amount);

    emit CommunityStake(msg.sender, stakee, amount);
  }

  function slash(address[] calldata accounts, uint64 slashedPercent) external {
    slashes[slashCount].percent = slashedPercent;
    slashes[slashCount].time = uint64(block.timestamp);
    slashes[slashCount].accounts = accounts;

    emit SlashEvent(msg.sender, slashedPercent, slashCount);

    slashCount++;
  }

  function withdraw() external {
  }

  // This kind of sucks because if there are new community stakers
  // after your slash but before the burn, they'll be slashed too
  // So we need to store more info or something
  function burn(uint256[] calldata slashIds) external {
    uint256 amountToBurn = 0;

    uint256 numIds = slashIds.length;
    for (uint256 i = 0; i < numIds; i++) {
      uint64 slashedPercent = slashes[slashIds[i]].percent;

      for (uint256 j = 0; j < slashes[slashIds[i]].accounts.length; j++) {
        address account = slashes[slashIds[i]].accounts[j];
        uint256 selfStakeCount = selfStakeIds[account].length;
        for (uint256 k = 0; k < selfStakeCount; k++) {
          uint256 stakeId = selfStakeIds[account][k];
          uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) /
            100;
          stakes[stakeId].amount -= slashedAmount;
          amountToBurn += slashedAmount;
        }

        uint256 numStakedOnByMe = communityStakeesForAddress[account].length();
        for (uint256 k = 0; k < numStakedOnByMe; k++) {
          address stakee = communityStakeesForAddress[account].at(k);
          uint256 numStakes = communityStakeIds[account][stakee].length;
          for (uint256 l = 0; l < numStakes; l++) {
            uint256 stakeId = communityStakeIds[account][stakee][l];
            uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) /
              100;
            stakes[stakeId].amount -= slashedAmount;
            amountToBurn += slashedAmount;
          }
        }

        uint256 numOthersStakingMe = communityStakersForAddress[account]
          .length();
        for (uint256 k = 0; k < numOthersStakingMe; k++) {
          address staker = communityStakersForAddress[account].at(k);
          uint256 numStakes = communityStakeIds[staker][account].length;
          for (uint256 l = 0; l < numStakes; l++) {
            uint256 stakeId = communityStakeIds[staker][account][l];
            uint256 slashedAmount = (slashedPercent * stakes[stakeId].amount) /
              100;
            stakes[stakeId].amount -= slashedAmount;
            amountToBurn += slashedAmount;
          }
        }
      }

      delete slashes[slashIds[i]];
    }

    gtc.transfer(address(1), amountToBurn);

    emit Burn(msg.sender);
  }

  // Pseudocode
  // function release(address, amount, slashId) external {
  //   require(msg.sender has Releaser role)
  // }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

// Only one stake per stakee:staker, lock period
contract GitcoinIdentityStaking4 is
  Initializable,
  UUPSUpgradeable,
  AccessControlUpgradeable,
  PausableUpgradeable
{
  using EnumerableSet for EnumerableSet.AddressSet;

  bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

  error OnlySlasher();
  error OnlyAdmin();

  mapping(address => uint256) public selfStakeAmount;
  mapping(address => mapping(address => uint256)) public communityStakeAmounts;

  mapping(address staker => mapping(address stakee => bool))
    public unlockPending;

  mapping(address => EnumerableSet.AddressSet)
    private communityStakersForAddress;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakeesForAddress;

  uint256 public currentBurnRound = 1;

  mapping(uint256 round => uint256 amount) public totalSlashed;

  // Used to permit unfreeze
  mapping(uint256 => bool) public slashProofHashes;

  event SelfStake(address indexed staker, uint256 amount);
  event CommunityStake(
    address indexed staker,
    address indexed stakee,
    uint256 amount
  );

  event SlashEvent(
    address indexed slasher,
    uint64 slashedPercent,
    uint256 slashProofHash
  );

  event Burn(uint256 indexed round, uint256 amount);

  GTC public gtc;

  function initialize(address gtcAddress) public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();

    gtc = GTC(gtcAddress);
  }

  function selfStake(uint256 amount) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockPending[msg.sender][msg.sender] == false, "Unlock pending");

    gtc.transferFrom(msg.sender, address(this), amount);

    selfStakeAmount[msg.sender] += amount;

    emit SelfStake(msg.sender, amount);
  }

  function communityStake(address stakee, uint256 amount) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockPending[msg.sender][stakee] == false, "Unlock pending");

    communityStakeAmounts[msg.sender][stakee] += amount;

    gtc.transferFrom(msg.sender, address(this), amount);

    communityStakeesForAddress[msg.sender].add(stakee);
    communityStakersForAddress[stakee].add(msg.sender);

    emit CommunityStake(msg.sender, stakee, amount);
  }

  function slash(
    address[] calldata accounts,
    uint64 slashedPercent,
    uint256 slashProofHash
  ) external {
    uint256 numAccounts = accounts.length;

    for (uint256 i = 0; i < numAccounts; i++) {
      address account = accounts[i];

      uint256 selfSlashedAmount = (slashedPercent * selfStakeAmount[account]) /
        100;
      totalSlashed[currentBurnRound] += selfSlashedAmount;
      selfStakeAmount[account] -= selfSlashedAmount;

      uint256 numStakedOnByMe = communityStakeesForAddress[account].length();
      for (uint256 j = 0; j < numStakedOnByMe; j++) {
        address stakee = communityStakeesForAddress[account].at(j);
        uint256 slashedAmount = (slashedPercent *
          communityStakeAmounts[account][stakee]) / 100;
        totalSlashed[currentBurnRound] += slashedAmount;
        communityStakeAmounts[account][stakee] -= slashedAmount;
      }

      uint256 numOthersStakingMe = communityStakersForAddress[account].length();
      for (uint256 j = 0; j < numOthersStakingMe; j++) {
        address staker = communityStakersForAddress[account].at(j);
        uint256 slashedAmount = (slashedPercent *
          communityStakeAmounts[staker][account]) / 100;
        totalSlashed[currentBurnRound] += slashedAmount;
        communityStakeAmounts[staker][account] -= slashedAmount;
      }
    }

    slashProofHashes[slashProofHash] = true;

    emit SlashEvent(msg.sender, slashedPercent, slashProofHash);
  }

  // Burn last round, start next round (locking this round)
  // Rounds don't matter, this is just to time the slashing
  function burn() external {
    // TODO check that threshold has passed since last burn, save this timestamp

    gtc.transfer(address(1), totalSlashed[currentBurnRound - 1]);

    currentBurnRound++;

    emit Burn(currentBurnRound - 1, totalSlashed[currentBurnRound - 1]);
  }

  // Pseudocode
  // function release(address, amount, proof, slashProofHash) external {
  //   require(msg.sender has Releaser role)
  //   require(slashProofHashes[slashProofHash], "Slash proof hash not found");
  //   checkProof(proof, slashProofHash); // Probably merkle membership?
  //   // release
  // }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

// Only one stake per stakee:staker
contract GitcoinIdentityStaking5 is
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

  mapping(address => Stake) public selfStakeAmount;
  mapping(address => mapping(address => Stake)) public communityStakeAmounts;

  mapping(address staker => mapping(address stakee => bool))
    public unlockPending;

  mapping(address => EnumerableSet.AddressSet)
    private communityStakersForAddress;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakeesForAddress;

  uint256 public currentBurnRound = 1;

  mapping(uint256 round => uint256 amount) public totalSlashed;

  // Used to permit unfreeze
  mapping(uint256 => bool) public slashProofHashes;

  event SelfStake(address indexed staker, uint256 amount);
  event CommunityStake(
    address indexed staker,
    address indexed stakee,
    uint256 amount
  );

  event SlashEvent(
    address indexed slasher,
    uint64 slashedPercent,
    uint256 slashProofHash
  );

  event Burn(uint256 indexed round, uint256 amount);

  GTC public gtc;

  function initialize(address gtcAddress) public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();

    gtc = GTC(gtcAddress);
  }

  function selfStake(uint256 amount, uint64 unlockTime) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockPending[msg.sender][msg.sender] == false, "Unlock pending");

    gtc.transferFrom(msg.sender, address(this), amount);

    selfStakeAmount[msg.sender].amount += amount;
    selfStakeAmount[msg.sender].unlockTime = unlockTime;

    emit SelfStake(msg.sender, amount);
  }

  function communityStake(
    address stakee,
    uint256 amount,
    uint64 unlockTime
  ) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockPending[msg.sender][stakee] == false, "Unlock pending");

    communityStakeAmounts[msg.sender][stakee].amount += amount;
    communityStakeAmounts[msg.sender][stakee].unlockTime = unlockTime;

    gtc.transferFrom(msg.sender, address(this), amount);

    communityStakeesForAddress[msg.sender].add(stakee);
    communityStakersForAddress[stakee].add(msg.sender);

    emit CommunityStake(msg.sender, stakee, amount);
  }

  function slash(
    address[] calldata accounts,
    uint64 slashedPercent,
    uint256 slashProofHash
  ) external {
    uint256 numAccounts = accounts.length;

    for (uint256 i = 0; i < numAccounts; i++) {
      address account = accounts[i];

      uint256 selfSlashedAmount = (slashedPercent *
        selfStakeAmount[account].amount) / 100;
      totalSlashed[currentBurnRound] += selfSlashedAmount;
      selfStakeAmount[account].amount -= selfSlashedAmount;

      uint256 numStakedOnByMe = communityStakeesForAddress[account].length();
      for (uint256 j = 0; j < numStakedOnByMe; j++) {
        address stakee = communityStakeesForAddress[account].at(j);
        uint256 slashedAmount = (slashedPercent *
          communityStakeAmounts[account][stakee].amount) / 100;
        totalSlashed[currentBurnRound] += slashedAmount;
        communityStakeAmounts[account][stakee].amount -= slashedAmount;
      }

      uint256 numOthersStakingMe = communityStakersForAddress[account].length();
      for (uint256 j = 0; j < numOthersStakingMe; j++) {
        address staker = communityStakersForAddress[account].at(j);
        uint256 slashedAmount = (slashedPercent *
          communityStakeAmounts[staker][account].amount) / 100;
        totalSlashed[currentBurnRound] += slashedAmount;
        communityStakeAmounts[staker][account].amount -= slashedAmount;
      }
    }

    slashProofHashes[slashProofHash] = true;

    emit SlashEvent(msg.sender, slashedPercent, slashProofHash);
  }

  // Burn last round, start next round (locking this round)
  // Rounds don't matter, this is just to time the slashing
  function burn() external {
    // TODO check that threshold has passed since last burn, save this timestamp

    gtc.transfer(address(1), totalSlashed[currentBurnRound - 1]);

    emit Burn(currentBurnRound - 1, totalSlashed[currentBurnRound - 1]);

    currentBurnRound++;
  }

  // Pseudocode
  // function release(address, amount, proof, slashProofHash) external {
  //   require(msg.sender has Releaser role)
  //   require(slashProofHashes[slashProofHash], "Slash proof hash not found");
  //   checkProof(proof, slashProofHash); // Probably merkle membership?
  //   // release
  // }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

// Only one stake per stakee:staker, store amount as uint192
contract GitcoinIdentityStaking6 is
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
    uint192 amount;
    uint64 unlockTime;
  }

  mapping(address => Stake) public selfStakeAmount;
  mapping(address => mapping(address => Stake)) public communityStakeAmounts;

  mapping(address staker => mapping(address stakee => bool))
    public unlockPending;

  mapping(address => EnumerableSet.AddressSet)
    private communityStakersForAddress;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakeesForAddress;

  uint256 public currentBurnRound = 1;

  mapping(uint256 round => uint192 amount) public totalSlashed;

  // Used to permit unfreeze
  mapping(uint256 => bool) public slashProofHashes;

  event SelfStake(address indexed staker, uint256 amount);
  event CommunityStake(
    address indexed staker,
    address indexed stakee,
    uint256 amount
  );

  event SlashEvent(
    address indexed slasher,
    uint64 slashedPercent,
    uint256 slashProofHash
  );

  event SlashAddresses(
    address indexed slasher
  );

  event Burn(uint256 indexed round, uint256 amount);

  GTC public gtc;

  function initialize(address gtcAddress) public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();

    gtc = GTC(gtcAddress);
  }

  function selfStake(uint192 amount, uint64 unlockTime) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockPending[msg.sender][msg.sender] == false, "Unlock pending");

    gtc.transferFrom(msg.sender, address(this), uint256(amount));

    selfStakeAmount[msg.sender].amount += amount;
    selfStakeAmount[msg.sender].unlockTime = unlockTime;

    emit SelfStake(msg.sender, amount);
  }

  function communityStake(
    address stakee,
    uint192 amount,
    uint64 unlockTime
  ) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockPending[msg.sender][stakee] == false, "Unlock pending");

    communityStakeAmounts[msg.sender][stakee].amount += amount;
    communityStakeAmounts[msg.sender][stakee].unlockTime = unlockTime;

    gtc.transferFrom(msg.sender, address(this), uint256(amount));

    communityStakeesForAddress[msg.sender].add(stakee);
    communityStakersForAddress[stakee].add(msg.sender);

    emit CommunityStake(msg.sender, stakee, amount);
  }

  function slash(
    address[] calldata accounts,
    uint64 slashedPercent,
    uint256 slashProofHash
  ) external {
    uint256 numAccounts = accounts.length;

    for (uint256 i = 0; i < numAccounts; i++) {
      address account = accounts[i];

      uint192 selfSlashedAmount = (slashedPercent *
        selfStakeAmount[account].amount) / 100;
      totalSlashed[currentBurnRound] += selfSlashedAmount;
      selfStakeAmount[account].amount -= selfSlashedAmount;

      uint256 numStakedOnByMe = communityStakeesForAddress[account].length();
      for (uint256 j = 0; j < numStakedOnByMe; j++) {
        address stakee = communityStakeesForAddress[account].at(j);
        uint192 slashedAmount = (slashedPercent *
          communityStakeAmounts[account][stakee].amount) / 100;
        totalSlashed[currentBurnRound] += slashedAmount;
        communityStakeAmounts[account][stakee].amount -= slashedAmount;
      }

      uint256 numOthersStakingMe = communityStakersForAddress[account].length();
      for (uint256 j = 0; j < numOthersStakingMe; j++) {
        address staker = communityStakersForAddress[account].at(j);
        uint192 slashedAmount = (slashedPercent *
          communityStakeAmounts[staker][account].amount) / 100;
        totalSlashed[currentBurnRound] += slashedAmount;
        communityStakeAmounts[staker][account].amount -= slashedAmount;
      }
    }

    slashProofHashes[slashProofHash] = true;

    emit SlashEvent(msg.sender, slashedPercent, slashProofHash);
  }

  function slashAddresses(address[] calldata stakers, address[] calldata stakees, uint64 percent) external {
    for (uint256 i = 0; i < stakers.length; i++) {
      address staker = stakers[i];
      address stakee = stakees[i];

      uint192 slashedAmount = (percent *
        communityStakeAmounts[staker][stakee].amount) / 100;
      totalSlashed[currentBurnRound] += slashedAmount;
      communityStakeAmounts[staker][stakee].amount -= slashedAmount;
    }

    emit SlashAddresses(msg.sender);
  }

  // Burn last round, start next round (locking this round)
  // Rounds don't matter, this is just to time the slashing
  function burn() external {
    // TODO check that threshold has passed since last burn, save this timestamp

    gtc.transfer(address(1), uint256(totalSlashed[currentBurnRound - 1]));

    emit Burn(currentBurnRound - 1, uint256(totalSlashed[currentBurnRound - 1]));

    currentBurnRound++;
  }

  // Pseudocode
  // function release(address, amount, proof, slashProofHash) external {
  //   require(msg.sender has Releaser role)
  //   require(slashProofHashes[slashProofHash], "Slash proof hash not found");
  //   checkProof(proof, slashProofHash); // Probably merkle membership?
  //   // release
  // }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

// store amount as uint192
contract GitcoinIdentityStaking7 is
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
    uint192 amount;
    uint64 unlockTime;
  }

  mapping(address => uint256[]) public selfStakeIds;
  mapping(address => mapping(address => uint256[])) public communityStakeIds;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakersForAddress;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakeesForAddress;

  mapping(uint256 stakeId => Stake) public stakes;
  uint256 public stakeCount;

  uint256 public currentBurnRound = 1;

  mapping(uint256 round => uint192 amount) public totalSlashed;

  // Used to permit unfreeze
  mapping(uint256 => bool) public slashProofHashes;

  event SelfStake(address indexed staker, uint256 amount);
  event CommunityStake(
    address indexed staker,
    address indexed stakee,
    uint256 amount
  );

  event SlashEvent(
    address indexed slasher,
    uint64 slashedPercent,
    uint256 slashProofHash
  );

  event Burn(uint256 indexed round, uint256 amount);

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

    communityStakeesForAddress[msg.sender].add(stakee);
    communityStakersForAddress[stakee].add(msg.sender);

    emit CommunityStake(msg.sender, stakee, amount);
  }

  function slash(
    address[] calldata accounts,
    uint64 slashedPercent,
    uint256 slashProofHash
  ) external {
    uint256 numAccounts = accounts.length;

    for (uint256 i = 0; i < numAccounts; i++) {
      address account = accounts[i];
      uint256 numSelfStakes = selfStakeIds[account].length;
      for (uint256 j = 0; j < numSelfStakes; j++) {
        uint256 stakeId = selfStakeIds[account][j];
        uint192 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
        totalSlashed[currentBurnRound] += slashedAmount;
        stakes[stakeId].amount -= slashedAmount;
      }

      uint256 numStakedOnByMe = communityStakeesForAddress[account].length();
      for (uint256 j = 0; j < numStakedOnByMe; j++) {
        address stakee = communityStakeesForAddress[account].at(j);
        uint256 numStakes = communityStakeIds[account][stakee].length;
        for (uint256 k = 0; k < numStakes; k++) {
          uint256 stakeId = communityStakeIds[account][stakee][k];
          uint192 slashedAmount = (slashedPercent * stakes[stakeId].amount) /
            100;
          totalSlashed[currentBurnRound] += slashedAmount;
          stakes[stakeId].amount -= slashedAmount;
        }
      }

      uint256 numOthersStakingMe = communityStakersForAddress[account].length();
      for (uint256 j = 0; j < numOthersStakingMe; j++) {
        address staker = communityStakersForAddress[account].at(j);
        uint256 numStakes = communityStakeIds[staker][account].length;
        for (uint256 k = 0; k < numStakes; k++) {
          uint256 stakeId = communityStakeIds[staker][account][k];
          uint192 slashedAmount = (slashedPercent * stakes[stakeId].amount) /
            100;
          totalSlashed[currentBurnRound] += slashedAmount;
          stakes[stakeId].amount -= slashedAmount;
        }
      }
    }

    slashProofHashes[slashProofHash] = true;

    emit SlashEvent(msg.sender, slashedPercent, slashProofHash);
  }

  // Burn last round, start next round (locking this round)
  // Rounds don't matter, this is just to time the slashing
  function burn() external {
    // TODO check that threshold has passed since last burn, save this timestamp

    gtc.transfer(address(1), totalSlashed[currentBurnRound - 1]);

    emit Burn(currentBurnRound - 1, totalSlashed[currentBurnRound - 1]);

    currentBurnRound++;
  }

  // Pseudocode
  // function release(address, amount, proof, slashProofHash) external {
  //   require(msg.sender has Releaser role)
  //   require(slashProofHashes[slashProofHash], "Slash proof hash not found");
  //   checkProof(proof, slashProofHash); // Probably merkle membership?
  //   // release
  // }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

// Tracking slashes explicitly in contract
// store amount as uint192
contract GitcoinIdentityStaking8 is
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
    uint192 amount;
    uint64 unlockTime;
  }

  struct Slash {
    uint192 amount;
    uint64 time;
    address[] accounts;
  }

  mapping(address => uint256[]) public selfStakeIds;
  mapping(address => mapping(address => uint256[])) public communityStakeIds;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakersForAddress;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakeesForAddress;

  mapping(uint256 stakeId => Stake) public stakes;
  mapping(uint256 slashId => Slash) public slashes;
  uint256 public stakeCount;
  uint256 public slashCount;

  event SelfStake(address indexed staker, uint256 amount);
  event CommunityStake(
    address indexed staker,
    address indexed stakee,
    uint256 amount
  );

  event SlashEvent(
    address indexed slasher,
    uint64 slashedPercent,
    uint256 slashCount
  );

  event Burn(address indexed burner);

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

    selfStakeIds[msg.sender].push(stakeId);

    gtc.transferFrom(msg.sender, address(this), uint256(amount));

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

    communityStakeesForAddress[msg.sender].add(stakee);
    communityStakersForAddress[stakee].add(msg.sender);

    gtc.transferFrom(msg.sender, address(this), uint256(amount));

    emit CommunityStake(msg.sender, stakee, amount);
  }

  function slash(address[] calldata accounts, uint64 slashedPercent) external {
    uint192 totalSlashed = 0;
    uint256 numAccounts = accounts.length;
    for (uint256 i = 0; i < numAccounts; i++) {
      address account = accounts[i];
      uint256 selfStakeCount = selfStakeIds[account].length;
      for (uint256 j = 0; j < selfStakeCount; j++) {
        uint256 stakeId = selfStakeIds[account][j];
        uint192 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
        stakes[stakeId].amount -= slashedAmount;
        totalSlashed += slashedAmount;
      }

      uint256 numStakedOnByMe = communityStakeesForAddress[account].length();
      for (uint256 j = 0; j < numStakedOnByMe; j++) {
        address stakee = communityStakeesForAddress[account].at(j);
        uint256 numStakes = communityStakeIds[account][stakee].length;
        for (uint256 k = 0; k < numStakes; k++) {
          uint256 stakeId = communityStakeIds[account][stakee][k];
          uint192 slashedAmount = (slashedPercent * stakes[stakeId].amount) /
            100;
          stakes[stakeId].amount -= slashedAmount;
          totalSlashed += slashedAmount;
        }
      }

      uint256 numOthersStakingMe = communityStakersForAddress[account].length();
      for (uint256 j = 0; j < numOthersStakingMe; j++) {
        address staker = communityStakersForAddress[account].at(j);
        uint256 numStakes = communityStakeIds[staker][account].length;
        for (uint256 k = 0; k < numStakes; k++) {
          uint256 stakeId = communityStakeIds[staker][account][k];
          uint192 slashedAmount = (slashedPercent * stakes[stakeId].amount) /
            100;
          stakes[stakeId].amount -= slashedAmount;
          totalSlashed += slashedAmount;
        }
      }
    }

    slashes[slashCount].amount = totalSlashed;
    slashes[slashCount].time = uint64(block.timestamp);
    slashes[slashCount].accounts = accounts;

    slashCount++;

    emit SlashEvent(msg.sender, slashedPercent, slashCount);
  }

  function burn(uint256[] calldata slashIds) external {
    uint192 amountToBurn = 0;

    uint256 numIds = slashIds.length;
    for (uint256 i = 0; i < numIds; i++) {
      uint256 slashId = slashIds[i];
      if (slashes[slashId].time > 0) {
        amountToBurn += slashes[slashId].amount;
        delete slashes[slashId];
      }
    }

    gtc.transfer(address(1), uint256(amountToBurn));

    emit Burn(msg.sender);
  }

  // Pseudocode
  // function release(address, amount, slashId) external {
  //   require(msg.sender has Releaser role)
  //   require(slashed[slashId] exists)
  //   require(slashes[slashId].accounts.contains(address))
  //   // release
  // }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

// Track slashes explicitly, move gas usage to burn
// use uint192 for amount
// use stakeIds for slashing
contract GitcoinIdentityStaking10 is
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
    uint192 amount;
    uint64 unlockTime;
  }

  struct Slash {
    uint64 percent;
    uint64 time;
    uint256[] stakeIds;
  }

  mapping(address => uint256[]) public selfStakeIds;
  mapping(address => mapping(address => uint256[])) public communityStakeIds;

  mapping(uint256 stakeId => Stake) public stakes;
  mapping(uint256 slashId => Slash) public slashes;
  uint256 public stakeCount;
  uint256 public slashCount;

  event SelfStake(address indexed staker, uint192 amount);
  event CommunityStake(
    address indexed staker,
    address indexed stakee,
    uint192 amount
  );

  event SlashEvent(
    address indexed slasher,
    uint64 slashedPercent,
    uint256 slashCount
  );

  event Burn(address indexed burner);

  GTC public gtc;

  function initialize(address gtcAddress) public initializer {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

    __AccessControl_init();
    __Pausable_init();

    gtc = GTC(gtcAddress);
  }

  // For this one, getting self and community stake totals is
  // WAY more complex, all the slashing calculations from the
  // `burn` function must be executed for **any** read. But
  // if we don't need to ever read this data as part of a
  // transaction, that's fine

  function selfStake(uint192 amount, uint64 unlockTime) external {
    require(amount > 0, "Amount must be greater than 0");
    require(unlockTime > block.timestamp, "Unlock time must be in the future");

    uint256 stakeId = ++stakeCount;
    stakes[stakeId].amount = amount;
    stakes[stakeId].unlockTime = unlockTime;

    selfStakeIds[msg.sender].push(stakeId);

    gtc.transferFrom(msg.sender, address(this), amount);

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

  function slash(uint256[] calldata stakeIds, uint64 slashedPercent) external {
    slashes[slashCount].percent = slashedPercent;
    slashes[slashCount].time = uint64(block.timestamp);
    slashes[slashCount].stakeIds = stakeIds;

    // include hash of stakeIds in event?
    emit SlashEvent(msg.sender, slashedPercent, slashCount);

    slashCount++;
  }

  function withdraw() external {
  }

  function burn(uint256[] calldata slashIds) external {
    uint192 amountToBurn = 0;

    uint256 numIds = slashIds.length;
    for (uint256 i = 0; i < numIds; i++) {
      uint64 slashedPercent = slashes[slashIds[i]].percent;

      uint256 numStakes = slashes[slashIds[i]].stakeIds.length;

      for (uint256 j = 0; j < numStakes; j++) {
        uint256 stakeId = slashes[slashIds[i]].stakeIds[j];
        uint192 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
        stakes[stakeId].amount -= slashedAmount;
        amountToBurn += slashedAmount;
      }

      delete slashes[slashIds[i]];
    }

    gtc.transfer(address(1), uint256(amountToBurn));

    emit Burn(msg.sender);
  }

  // Pseudocode
  // function release(address, amount, slashId) external {
  //   require(msg.sender has Releaser role)
  // }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

// store amount as uint192
// slash with stake IDs
contract GitcoinIdentityStaking11 is
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
    uint192 amount;
    uint64 unlockTime;
  }

  mapping(address => uint256[]) public selfStakeIds;
  mapping(address => mapping(address => uint256[])) public communityStakeIds;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakersForAddress;
  mapping(address => EnumerableSet.AddressSet)
    private communityStakeesForAddress;

  mapping(uint256 stakeId => Stake) public stakes;
  uint256 public stakeCount;

  uint256 public currentBurnRound = 1;

  mapping(uint256 round => uint192 amount) public totalSlashed;

  // Used to permit unfreeze
  mapping(uint256 => bool) public slashProofHashes;

  event SelfStake(address indexed staker, uint256 amount);
  event CommunityStake(
    address indexed staker,
    address indexed stakee,
    uint256 amount
  );

  event SlashEvent(
    address indexed slasher,
    uint64 slashedPercent,
    uint256 slashProofHash
  );

  event Burn(uint256 indexed round, uint256 amount);

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
    uint256 slashProofHash
  ) external {
    uint256 numStakes = stakeIds.length;

    for (uint256 i = 0; i < numStakes; i++) {
      uint256 stakeId = stakeIds[i];
      uint192 slashedAmount = (slashedPercent * stakes[stakeId].amount) / 100;
      totalSlashed[currentBurnRound] += slashedAmount;
      stakes[stakeId].amount -= slashedAmount;
    }

    slashProofHashes[slashProofHash] = true;

    emit SlashEvent(msg.sender, slashedPercent, slashProofHash);
  }

  // Burn last round, start next round (locking this round)
  // Rounds don't matter, this is just to time the slashing
  function burn() external {
    // TODO check that threshold has passed since last burn, save this timestamp

    gtc.transfer(address(1), totalSlashed[currentBurnRound - 1]);

    emit Burn(currentBurnRound - 1, totalSlashed[currentBurnRound - 1]);

    currentBurnRound++;
  }

  // Pseudocode
  // function release(address, amount, proof, slashProofHash) external {
  //   require(msg.sender has Releaser role)
  //   require(slashProofHashes[slashProofHash], "Slash proof hash not found");
  //   checkProof(proof, slashProofHash); // Probably merkle membership?
  //   // release
  // }

  function _authorizeUpgrade(
    address
  ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}

