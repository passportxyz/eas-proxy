# eas-proxy

This EAS proxy will be the attester who will write the stamps into EAS attestations

## Deployments

See latest contract addresses and other deployment
info&mdash;organized by chain ID&mdash;[here](deployments/onchainInfo.json).

## Issuers

These are the addresses signing attestation data, the verifier only accepts attestations
signed by the appropriate address.

The production address is used only in the production environment of the
Passport app with mainnet chains.
The testnet address is used with all other environments.

_Note: this is not the **attester** address, which can be found in the file
above for each chain as the GitcoinAttester contract address._

### Production

0x804233b96cbd6d81efeb6517347177ef7bD488ED

### Test

0x5f603Ed913738d9105bAf3BD981AA4750016B167

## Initial Deployment Process

Run deployments with `npx hardhat run scripts/<deploymentScript> --network <network>`

Verify with `npx hardhat verify <contractAddress> --network <network>`

1. Set the IAM_ISSUER_ADDRESS to the correct value (testnet vs. mainnet) in
   your .env
2. deployVerifierAndAttester.ts
3. deployResolver.ts
4. Verify contracts, make sure everything looks good
5. transferOwnership.ts
6. Create EAS schemas pointing to the new resolver

The verifier and attester also have separate deploy scripts if needed. In this
case, be sure to call `addVerifier` on the Attester contract from the
owner account.
