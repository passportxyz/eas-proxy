## General

* **Replace `require` with custom errors to save gas:** Consider using custom error handling to replace `require` statements to provide more descriptive error messages without removing any code.
    
* **Use `external` instead of `public` functions:** When possible, mark functions as `external` instead of `public` to save gas and enhance security.
    
  
## GitcoinAttester.sol

- L8: `import { AttestationRequest, AttestationRequestData, IEAS, Attestation, MultiAttestationRequest, MultiRevocationRequest } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";` unused imports
  - recommendation: remove unused imports
- L20: `IEAS eas` missing visibility
  - recommendation: mark explicit as `public` or `private`
- L28, 33, 32, 47, 57, 67, 77, 92: `initialize`, `pause`, `unpause`, `addVerifier`, `removeVerifier`, `setEASAddress`, `submitAttestations`, `revokeAttestations` can be marked as external to save gas.
- `Pausable` is imported, initialized, but never used.
  - recommendation: remove Pausable

## GitcoinPassportDecoder.sol
- L25: `IEAS eas` missing visibility
  - recommendation: mark explicit as `public` or `private`
- `Pausable` is imported, initialized, but never used.
  - recommendation: remove Pausable

- L58: `setEASAddress` can be marked as external
- L66: `setGitcoinResolver`  can be marked as external
- L74: `setSchemaUID`  can be marked as external
- L82: `addProvider`  can be marked as external
- L106: `getPassport`  can be marked as external
- L95: `getAttestation` should be marked as external and function logic should be moved into internal function to call it in line 116
- L58: `setEASAddress` missing event
- L66: `setGitcoinResolver`  missing event
- L74: `setSchemaUID`  missing event
- L82: `addProvider`  missing event

- `getPassport`: The getPassport function is designed to get the attestations of a user and decodes them on chain. Therefore it iterates through two nested for loops. The operations in the for loops can quickly reach the blockchain limitations and hit the gas limits. Since every contract which interacts with this function is at risk, it's highly recommended to revisit the way attestations are stored.

## GitcoinResolver.sol

- L8: `import { AttestationRequest, AttestationRequestData, EAS, Attestation, MultiAttestationRequest, IEAS } from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";` unused imports
  - recommendation: remove unused imports
- L52-65: `gitcoinAttester` can be initialized with zero addess
  - recommendation: add zero address check
- L75-77: missing event
- L79-81: missing event
- L83: `pause` can be external
- L87: `unpause` can be external

- L108-123: `attest` Attestations are made based on the encoded Schema (__right?__)

  If calldata max size = 32kb
  and calldata is

  SchemaEncoder(
    "uint256[] providers, bytes32[] hashes, uint64[] issuanceDates, uint64[] expirationDates, uint16 providerMapVersion"
  );

  and each type has
  uint256 (providers): 32 bytes per element.
  bytes32 (hashes): 32 bytes per element.
  uint64 (issuanceDates and expirationDates): 8 bytes per element.
  uint16 (providerMapVersion): 2 bytes.
  //                  uint256 bitmap                hashes     issuance   expire
  => `32,768 bytes = (32 bytes * ceil(x/256)) + x * (32 bytes + 8 bytes + 8 bytes)`

  x represents the number of elements in an array

  which also can be represented by:
  `32,768 bytes = (32 bytes * ((x + 255) / 256)) + (x * (32 bytes + 8 bytes + 8 bytes))`

  ```
  32,768 = (32 * ((x + 255) / 256)) + (x * (32 + 8 + 8))
  32,768 = (x + 255) / 8 + 48x
  262,144 = x + 255 + 384x
  262,144 = 385x + 255
  262,144 - 255 = 385x
  x = (262,144 - 255) / 385
  x = 261,889 / 385
  x ≈ 679.715
  ```

  If we consider only the calldata size and no further smart contract operations, the maximum allowed attestation size is ≈ 679. 679 sounds like a pretty high number, but you should also consider that it will be incredible expensive on some chains to just have 50 stamps. Also the `getPassport` in `GitcoinPassportDecoder` will break a way earlier. 

  - recommendation: consider storing each stamp in an attestation.

## GitcoinVeraxPortal.sol

- L46-57: no zero address check for `_attester`, `_resolver` and `_veraxAttestationRegistry`
- L87: missing event
- L91: misisng event
- L95: missing event
- L102-164: gas optimization: instead of adding `numAttestations += multiAttestationRequests[i].data.length` you could simply pass `numAttestations` as function argument and check at the end of the second for loop if they're equal. Also the length param of the for loops should be cached
- L193: dies the contract `supportsInterface` of `IAbstractPortal` if so many functions are not implemented?

## GitcoinVerifier.sol

- L94-114: no zero address check for `_issuer` and `_attester`
- L172+202: cache `*.length` to save gas

## GitcoinVerifierWithVeraxPortal.sol

- L30: missing zero address check