# GitcoinVerifier

**Questions**
- `L282`: Thoughts on just withdrawing contract balance as opposed to specifying an amount ?

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

