// SPDX-License-Identifier: GPL
pragma solidity >=0.8.4;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AttestationRequest, AttestationRequestData, IEAS, Attestation, MultiAttestationRequest} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

import "./GitcoinAttester.sol";

/**
 * @title GitcoinVerifier
 * @notice Evaluation for writing stamps into an attestation of this form:  "bytes32[] providers, bytes32[] hashes", where providers is a bit array and hashes the array of bytes32 hashes
 */
contract GitcoinVerifierV1 {
    using ECDSA for bytes32;

    GitcoinAttester public attester;

    constructor(address _attester) {
        attester = GitcoinAttester(_attester);
    }

    function multiAttest(
        MultiAttestationRequest[] calldata multiAttestationRequest
    ) public payable returns (bytes32[] memory) {
        return attester.addPassport(multiAttestationRequest);
    }
}
