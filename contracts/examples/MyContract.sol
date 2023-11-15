// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "../IGitcoinPassportDecoder.sol";

/**
 * @title MyContract
 * @notice This is just a dummy smart contract that provides a permission method for incrementing a counter.
 * Permissions are determined by humanity score
 */
contract MyContract {
    /// Counter variable
    uint256 private counter;

    /// Threshold for humanity score
    /// TODO: it would make sense to add threshold variable to the GitcoinPassportDecoder contract porbably
    uint256 private threshold;

    IGitcoinPassportDecoder _decoder;

    ////////////////////////////////////////////////////////
    // Below are some example of modifiers (contraints/ permission checks)
    ////////////////////////////////////////////////////////

    // This would be possible once we roll out the decoder smart contract
    // This has the drawback, then the integrator needs to keep track of the threshold
    modifier onlyHuman() {
        require(threshold > 0, "Threshold not set");
        require(
            _decoder.getScore(msg.sender).score >= threshold,
            "Only humans allowed"
        );
        _;
    }

    // TODO: this is not scheduled yet
    // This would be an even simpler version compared to onlyHuman
    // It requires that the threshold (at least the default recommended one) is stored in the decoder
    modifier onlyHumanV2() {
        require(_decoder.isHuman(msg.sender), "Only humans allowed");
        _;
    }

    // This would be possible once we roll out the decoder smart contract
    // This is an example where an integrator gates a SC function based on the caller holding a specific 
    // credential
    modifier onlyGitcoinDonors() {
        Credential[] memory credentials = _decoder.getPassport(msg.sender);
        bool hasGitcoinStamp = false;
        uint256 numCredentials = credentials.length;
        for (uint256 i = 0; i < numCredentials; i++) {
            if (credentials[i].provider == "Gitcoin") {
                hasGitcoinStamp = true;
                break;
            }
        }
        require(hasGitcoinStamp, "Only Gitcoin donors allowed");

        _;
    }

    // TODO: this is not scheduled yet
    // This would be an even simpler version than the example in onlyGitcoinDonors
    modifier onlyMyPrefferedAttestationHolders() {
        require(
            _decoder.ownsAttestations(
                msg.sender,
                ["Gitcoin", "IdentityStaking"]
            ),
            "Only Gitcoin donors allowed"
        );

        _;
    }

    /**
     * The integrator needs to set the address of the GitcoinPassportDecoder contract
     * @param _decoderAddress the address of the GitcoinPassportDecoder contract
     */
    function setGitcoinPassportDecoderAddress(
        address _decoderAddress
    ) external {
        _decoder = IGitcoinPassportDecoder(_decoderAddress);
    }

    /**
     * The integrator needs to set the threshold
     * @param _threshold the threshold
     * 
     * @notice the threshold could also be maintaained in the GitcoinPassportDecoder
     */
    function setThreshold(uint256 _threshold) external {
        threshold = _threshold;
    }

    /**
     * This is an example on-chain transaction that can be proteced using a modifier
     * that checks for the humanity score.
     *
     * @param value the amount to increment with
     */
    function incrementCounter(uint256 value) external onlyHuman {
        counter += value;
    }
}

