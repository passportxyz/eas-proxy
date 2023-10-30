**General**
- Improve natspec documentation to capture input params and return value
- Nitpick but you could explore moving all the interfaces to it's

# GitcoinVerifier

**Questions**
- `L282`: Thoughts on just withdrawing contract balance as opposed to specifying an amount ?
- `L182`: When encoding, why include MULTI_ATTESTATION_REQUEST_TYPEHASH ? Is it cause passport aims to supports another verifier which could use a different format ?

**Low**
- `L6` : Recommend using `@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol`
- `L43-L80`: Recommend keeping constants with storage variables
- `L94`: Recommend adding natspec for `__GitcoinVerifier_initno no`
- `L34`: can be made constant with value `GitcoinVerifier`. Remove `L100` during initialize
- `L235`: Consider addressing the TODO via loop. It does increase gas cost but likely worth it unless passport team is confident that the IAM will work as expected
- `L202`: Recommend storing the length in variable as opposed to computing it at every iteration. Gas Optimisation 
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
- `L5` : Recommend using `@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol`
- `L20`: Mark the visibility of IEAS as `public` / `private` and then add a external function to read that
- `L48`, `L59`: Recommend adding custom errors like `VERIFIED_ALREADY_ADDED` / `INVALID_VERIFIED` for gas optimization
- `L68`: Emit event to make it easier to index and have the latest EAS address. Also add zero address check. Why not set this during `initialize` as well
- `L80`/ `L93` The msg.sender == owner() feels like extra code. Would recommend setting owner as verifier during `initialize` and clean update the check to. Also use custom errors instead of `require`
``` if (!verifiers[msg.sender]) revert NOT_VALID_VERIFIER()
```

# GitcoinResolver

**Questions**

- Once the flattened attestations are retured from EAS -> GitcoinAttestor -> GitcoinVerifier. How does the Resolver pick it up ? Is it a hook from EAS which invokes `attest` ?

**Low**
- `L59` Update check to ensure _gitcoinAttester is not zero
- `L135` Recommend gas optimizing
```
uint256 attestationsLength = attestations.length
for (uint i = 0; i < attestationsLength; ) {
    ...
}
```

# GitcoinPassportDecoder

**Low**
- `L20`: Mark the visibility of IEAS as `public` / `private` and then add a external function to read that
- `L58`: Emit event `setEASAddress`. Add zero check
- `L67`: Emit event `setGitcoinResolver`. Add zero check
- `L74`: Emit event `setSchemaUID`. Add zero check
- `L82`: Emit event `addProvider`. Add zero check
- `L90`: Emit event `createNewVersion`.
- `L146`, `L147`: Store .length as variables as use them in the for loop to save gas

**High**

- `L106`: It looks like we generate 1 attestation for all the stamps. The fact that we have nested loops makes this function quite expensive. Would recommend seeing if this can be done offchain instead.
If the goal of this function is to be consumed by other contracts, I fear it might be expensive for a protocol to make this call, fetch all the stamps and then run their computation. It may exceed the block limit as the project scales 
- `L167`: as opposed to hardcoding it to 256 , could we instead have a provider count variable / something else equivalent?i