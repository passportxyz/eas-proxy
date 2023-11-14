// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import { IGitcoinPassportDecoder, Credential, Score } from "./IGitcoinPassportDecoder.sol";

import "hardhat/console.sol";

/**
 * @title GitcoinPassportDecoder
 * @notice This contract is used to create the bit map of stamp providers onchain, which will allow us to score Passports fully onchain
 */
contract GitcoinPassportDecoderGasUsage {
  IGitcoinPassportDecoder public passportDecoder;

  // Verified Addresses
  mapping(address => uint256) public hasCredentials;
  mapping(address => uint256) public scores;

  constructor(address _passportDecoder) {
    passportDecoder = IGitcoinPassportDecoder(_passportDecoder);
  }

  function checkPassport(address userAddress) external {
    Credential[] memory credentials = passportDecoder.getPassport(userAddress);
    if (credentials.length > 0) {
      hasCredentials[userAddress] = 1;
    }
  }

  function checkScore(address userAddress) external {
    Score memory score = passportDecoder.getScore(userAddress);

    if (score.score > 0) {
      scores[userAddress] = 1;
    }
  }
}
