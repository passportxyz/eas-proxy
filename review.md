## General

- **Replace `require` with custom errors to save gas:** Consider using custom error handling to replace `require` statements to provide more descriptive error messages without removing any code.
- **Use `external` instead of `public` functions:** When possible, mark functions as `external` instead of `public` to save gas and enhance security.
- Improve `natspec` documentation to capture function `arg` and `return` value.
- Consider moving all the interfaces to it's own folder to make the code organization cleaner.


# GitcoinVerifier

**Questions**
- `L282`: Thoughts on just withdrawing contract balance as opposed to specifying an amount ?
> This was a specific feature request
- `L182`: When encoding, why include MULTI_ATTESTATION_REQUEST_TYPEHASH ? Is it cause passport aims to supports another verifier which could use a different format ?
> We are just using EIP712 signatures

**Low**
- `L6` : Recommend using `@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol`
- `L43-L80`: Recommend keeping constants with storage variables
- `L94`: Recommend adding natspec for `__GitcoinVerifier_init`
- `L34`: can be made constant with value `GitcoinVerifier`. Remove `L100` during initialize
- `L94-114`: no zero address check for `_issuer` and `_attester`
- `L235`: Consider addressing the TODO via loop. It does increase gas cost but likely worth it unless passport team is confident that the IAM will work as expected
- `L172+L202`: Recommend storing the length in variable as opposed to computing it at every iteration. Gas Optimisation 
```javascript
uint256 attestationsLength = attestationRequest.multiAttestationRequest.length;
bytes32[] memory multiAttestHashes = new bytes32[](attestationsLength);
// avoids computing attestationsLength on every iteration 
for (uint i = 0; i < attestationsLength; ) {
    ...
}
```

# GitcoinAttester

**Questions**
- `L67`: Would it be possible to make `setEASAddress` external ?

**Low**
- `L8`: `import { AttestationRequest, AttestationRequestData, IEAS, Attestation, MultiAttestationRequest, MultiRevocationRequest } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";` remove unused imports
- `Pausable` is imported, initialized, but never used. recommendation: remove Pausable
- `L5` : Recommend using `@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol`
- `L20`: Mark the visibility of IEAS as `public` / `private` and then add a external function to read that
- `L28, 33, 32, 47, 57, 67, 77, 92`: `initialize`, `pause`, `unpause`, `addVerifier`, `removeVerifier`, `setEASAddress`, `submitAttestations`, `revokeAttestations` can be marked as external to save gas.
- `L48`, `L59`: Recommend adding custom errors like `VERIFIED_ALREADY_ADDED` / `INVALID_VERIFIED` for gas optimization
- `L68`: Emit event to make it easier to index and have the latest EAS address. Also add zero address check. Why not set this during `initialize` as well
- `L80`/ `L93` The msg.sender == owner() feels like extra code. Would recommend setting owner as verifier during `initialize` and clean update the check to. Also use custom errors instead of `require`
``` if (!verifiers[msg.sender]) revert NOT_VALID_VERIFIER()
```


# GitcoinResolver

**Questions**

- Once the flattened attestations are retured from EAS -> GitcoinAttestor -> GitcoinVerifier. How does the Resolver pick it up ? Is it a hook from EAS which invokes `attest` ?

**Low**
- `L8`: `import { AttestationRequest, AttestationRequestData, EAS, Attestation, MultiAttestationRequest, IEAS } from "@ethereum-attestation-service/eas-contracts/contracts/EAS.sol";` remove unused imports
- `L59` Update check to ensure _gitcoinAttester is not zero
- `L52-65`: `gitcoinAttester` can be initialized with zero addess. Add zero address check
- `L135` Recommend gas optimizing
```
uint256 attestationsLength = attestations.length
for (uint i = 0; i < attestationsLength; ) {
    ...
}
```
- `L75-77`: missing event
- `L79-81`: missing event
- `L83`: `pause` can be external
- `L87`: `unpause` can be external
- `L108-123``: `attest` Attestations are made based on the encoded Schema (__right?__)

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



# GitcoinPassportDecoder

**Low**
- `L20`: Mark the visibility of IEAS as `public` / `private` and then add a external function to read that
- `Pausable` is imported, initialized, but never used. Recommendation: remove Pausable
> we are going to add the pausable functions
- `L58`: `setEASAddress` can be marked as external
- `L58`: Emit event `setEASAddress`. Add zero check
- `L66`: `setGitcoinResolver`  can be marked as external
- `L67`: Emit event `setGitcoinResolver`. Add zero check
- `L74`: `setSchemaUID`  can be marked as external
- `L74`: Emit event `setSchemaUID`. Add zero check
- `L82`: `addProvider` can be marked as external
- `L82`: Emit event `addProvider`. Add zero check
- `L95`: `getAttestation` should be marked as external and function logic should be moved into internal function to call it in line 116
- `L90`: Emit event `createNewVersion`.
- `L106`: `getPassport`  can be marked as external
- `L146`, `L147`: Store .length as variables as use them in the for loop to save gas

**High**

- `getPassport`: The getPassport function is designed to get the attestations of a user and decodes them on chain. Therefore it iterates through two nested for loops. The operations in the for loops can quickly reach the blockchain limitations and hit the gas limits. Since every contract which interacts with this function is at risk, it's highly recommended to revisit the way attestations are stored.
Consider exploring if there can be an attestation for every stamp and the creating the link between the stamps cab be done off-chain
If the goal of this function is to be consumed by other contracts, I fear it might be expensive for a protocol to make this call, fetch all the stamps and then run their computation. It may exceed the block limit as the project scales 
- `L167`: as opposed to hardcoding it to 256 , could we instead have a provider count variable / something else equivalent?

**Response to High concerns**
> - in our current setup, the number of stamp providers that we have is < 100. This means, that all the providers that we have will be encoded in only 1 element of the providers array in the attestation
> - it is highly unlikely that we will reach more than 256 providers anytime soon, we are not in a race to increase our number of providers
> - we are revamping some of our stamps, which has the effect that we are removing some providers and introducing new ones. This is precisely why we have introduced a versioning for the stamps, for each version we will have a specific list of providers that can be stored in a passport attestation and a specific bitmap indicating how the bits in the providers array are allocated
> - so it seems that in the nested for-loop implementation in the `getPassport` implementation, the outer loop will never loop more than 1 element for the foreseeable future. The possibility to have more elements in the array still exists, but it is not yet on the horizon, and by the time we get to that point, there will probably be things to consider as well
> - regarding the suggestion `L167: as opposed to hardcoding it to 256 , could we instead have a provider count variable / something else equivalent?`
>   - this is not necessary, as that count would be equal to the length of any of the other arrays (`hashes`, `issuanceDates`, `expirationDates`), and in the current line 170 we already exit the loop if any of those lengths is reached:
> ```sol
>         // Check to make sure that the hashIndex is less than the length of the expirationDates array, and if not, exit the loop
>         if (hashIndex >= expirationDates.length) {
>           break;
>         }
> ```

# GitcoinVerifierWithVeraxPortal.sol

- L30: missing zero address check

## GitcoinVeraxPortal.sol

- L46-57: no zero address check for `_attester`, `_resolver` and `_veraxAttestationRegistry`
- L87: missing event
- L91: misisng event
- L95: missing event
- L102-164: gas optimization: instead of adding `numAttestations += multiAttestationRequests[i].data.length` you could simply pass `numAttestations` as function argument and check at the end of the second for loop if they're equal. Also the length param of the for loops should be cached
- L193: dies the contract `supportsInterface` of `IAbstractPortal` if so many functions are not implemented?
