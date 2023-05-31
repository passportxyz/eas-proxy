// SPDX-License-Identifier: GPL
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AttestationRequest, AttestationRequestData, IEAS, Attestation, MultiAttestationRequest} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

import "./GitcoinAttester.sol";

/**
 * @title GitcoinVerifier
 * @notice Evaluation for writing stamps into an attestation of this form:  "bytes32[] providers, bytes32[] hashes", where providers is a bit array and hashes the array of bytes32 hashes
 */
contract GitcoinVerifierV3 {
    using ECDSA for bytes32;

    GitcoinAttester public attester;

    struct Passport {
        bytes32[] providers;
        bytes32[] hashes;
    }

    mapping(address => Passport) attestations;

    constructor(address _attester) {
        attester = GitcoinAttester(_attester);
    }

    function multiAttest(Passport calldata passport) public payable {
        attestations[msg.sender] = passport;
    }
}
