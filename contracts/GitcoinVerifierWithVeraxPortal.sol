// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { GitcoinVerifier } from "./GitcoinVerifier.sol";
import { GitcoinVeraxPortal } from "./GitcoinVeraxPortal.sol";

/**
 * @title GitcoinVerifier
 * @notice This contract is used to verify a passport's authenticity and to add a passport to the GitcoinAttester contract using the verifyAndAttest() function.
 */
contract GitcoinVerifierWithVeraxPortal is GitcoinVerifier {
  using ECDSA for bytes32;

  GitcoinVeraxPortal public portal;

  /**
   * @notice Initializer function responsible for setting up the contract's initial state.
   * @param _issuer The address of the issuer of the passport.
   * @param _attester The address of the GitcoinAttester contract.
   * @param _portal The address of the GitcoinVeraxPortal contract.
   */
  function initialize(
    address _issuer,
    address _attester,
    address _portal
  ) public initializer {
    __GitcoinVerifier_init(_issuer, _attester);
    portal = GitcoinVeraxPortal(_portal);
  }

  /**
   * @dev Adds a passport to the attester contract, verifying it using the provided signature.
   * @param attestationRequest The passport to add.
   * @param v The v component of the signature.
   * @param r The r component of the signature.
   * @param s The s component of the signature.
   */
  function verifyAndAttest(
    PassportAttestationRequest calldata attestationRequest,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public payable override whenNotPaused returns (bytes32[] memory) {
    bytes32[] memory ids = super.verifyAndAttest(attestationRequest, v, r, s);

    portal.submitAttestations(attestationRequest.multiAttestationRequest);

    return ids;
  }
}
