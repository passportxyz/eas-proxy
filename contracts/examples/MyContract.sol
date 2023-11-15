// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "../GitcoinPassportDecoder.sol";

/**
 * @title GitcoinVerifier
 * @notice This contract is used to verify a passport's authenticity and to add a passport to the GitcoinAttester contract using the verifyAndAttest() function.
 */
contract MyContract {
    /// Counter variable
    uint256 private counter;

    /// Threshold for humanity score
    /// TODO: it would make sense to add threshold variable to decoder contract porbably
    uint256 private threshold;

    GitcoinPassportDecoder _decoder;

    // This would be possible once we roll out the decoder smart contract
    modifier onlyHuman() {
        require(threshold > 0, "Threshold not set");
        require(
            _decoder.getScore(msg.sender).score >= threshold,
            "Only humans allowed"
        );
        _;
    }

    // TODO: this is not scheduled yet
    // This would be an even simpler version
    // It requires that the threshold (at least the default recommended one) is stored in the decoder
    modifier onlyHumanV2() {
        require(_decoder.isHuman(msg.sender), "Only humans allowed");
        _;
    }

    // TODO: this is not scheduled yet
    // This would be an even simpler version
    // It requires that the threshold (at least the default recommended one) is stored in the decoder
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

    function setGitcoinPassportDecoderAddress(
        address _decoderAddress
    ) external {
        _decoder = GitcoinPassportDecoder(_decoderAddress);
    }

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


https://gist.github.com/nutrina/a59727e1681b7b783ddaebed3beeb2f4