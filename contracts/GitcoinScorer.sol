// SPDX-License-Identifier: GPL
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import {AttestationRequest, AttestationRequestData, IEAS, Attestation, MultiAttestationRequest} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import "hardhat/console.sol";

/**
 * @title GitcoinScorer
 * @dev A contract that scores a user passport based on his EAS Passport attestations
 */
contract GitcoinScorer is Ownable {
    // The instance of the EAS contract.
    IEAS eas;

    /**
     * @dev Store the weights for each stamp. This should be used for scoring.
     * This is a nested array. Firs index is the index of the provider in the providers array of the passport attestation.
     * The second index is the bit index.
     */
    uint256[][] public weights;

    /**
     * @dev Sets the address of the EAS contract.
     * @param _easContractAddress The address of the EAS contract.
     */
    function setEASAddress(address _easContractAddress) public onlyOwner {
        eas = IEAS(_easContractAddress);
    }

    /**
     * @dev Sets the scoring weights
     * @param _weights The new weights to be set
     */
    function setWeights(uint256[][] memory _weights) public onlyOwner {
        weights = _weights;
    }

    function getAttestation(
        bytes32 uuid
    ) public payable virtual returns (Attestation memory) {
        console.log("getting attestation ");
        Attestation memory a = eas.getAttestation(uuid);
        return a;
    }

    function scorePassport(
        address recipient
    ) public payable virtual returns (uint256 score) {
        score = 0;

        bytes32 uuid = 0x0; // resolver.getAttestationUUID(recipient);

        // First we decode the attestation, we need the providers and the hashes arrays
        Attestation memory attestation = eas.getAttestation(uuid);

        bytes32[] memory providers;
        bytes32[] memory hashes;
        (providers, hashes) = abi.decode(
            attestation.data,
            (bytes32[], bytes32[])
        );

        uint256 bit;
        uint256 hashIndex = 0;
        // Now we iterate over the providers array and check each bit that is set
        // If a bit is set, we get the has and the issuance date for the respective provider
        // and we add the weight to the score
        for (uint256 i = 0; i < providers.length; ) {
            bit = 1;
            uint256 provider = uint256(providers[i]);
            for (uint256 j = 0; j < 256; ) {
                // Check that the provider bit is set
                if (provider & bit > 0) {
                    // The provider bit is set, get the hash and the issuance date

                    if (hashIndex < hashes.length) {
                        bytes32 hashValue = hashes[hashIndex];

                        // TODO: deduplicate the hashValue

                        // If the hash value checks out, add the weight to the score
                        // score += weights[i][j];
                    }
                    hashIndex += 1;
                }
                bit <<= 1;
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }
    }
}
