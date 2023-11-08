# Initial Deployment Process

This is the process to deploy these contracts to a new chain:

1. If necessary, add the network to `hardhat.config.ts` and configure
   the relevant hardhat variables in your .env (based on .env-example)
2. Run `initializeChainInfo.ts` and follow instructions
3. Run `deployVerifierAndAttester.ts` (this calls addVerifier and setEASAddress)
4. Run `deployResolver.ts`
5. Run `deployPassportDecoder.ts`
6. Run `setupDecoder.ts`
7. Verify contracts, make sure everything looks good
8. Ensure `PASSPORT_MULTISIG_ADDRESS` is set in your .env, then run `transferOwnership.ts`
9. Create EAS schemas pointing to the new resolver,
   add to `onChainInfo.json`
10. In the Passport app, copy over the new `deployments` directory and
    configure `NEXT_PUBLIC_ACTIVE_ON_CHAIN_PASSPORT_CHAINIDS`
    and `NEXT_PUBLIC_POSSIBLE_ON_CHAIN_PASSPORT_CHAINIDS`

## Notes

### Missing Data

The scripts will alert you if anything is missing in the environment or onchainInfo.json.

### Deploying Attester and Verifier Separately

The verifier and attester also have separate deploy scripts if needed (for example,
if the attester succeeds but the verifier fails because of gas estimate issues
on testnets).

In this case, be sure to call `addVerifier` on the Attester contract from the
owner account (using a custom script or through the appropriate block explorer
with a verified contract).

### Timing

This whole process should take less than 1 hour, with the majority of time spent
setting up the new chain with hardhat.

Depending on the chain, it may be pertinent to do the deployment steps during a
low-activity period to save on gas.

### Deployment Gas Costs

It takes about 11 million gas to do the following:

- 3x implementation contract deployments (~3,000,000 each)
- 3x proxy contract deployments (~350,000 each)
- 1x addVerifier on GitcoinAttester (~50,000)
- 1x setEASAddress on GitcoinAttester (~50,000)
- 3x transferOwnership (~35,000 each)
- 2x EAS Schema registrations (~160,000 each)

_Note: this does not include any L1 fees if using an L2_

#### Redeployment

If the contracts need to be redeployed with the same code
(for example, if a test deployment is done to a mainnet),
then only the proxy contracts need to be redeployed.

This is handled automatically, simply repeat the same process
as above starting at step 3. Because the implementation
contracts do not need to be redeployed, this will require
much less gas.

## Example Deployment to Optimism

```bash
# Configure optimism network in hardhat settings
vim hardhat.config.ts
vim .env

npx hardhat run scripts/initializeChainInfo.ts --network optimism

# Add issuer and EAS addresses
vim deployments/onchainInfo.json

npx hardhat run scripts/deployVerifierAndAttester.ts --network optimism

npx hardhat run scripts/deployResolver.ts --network optimism

# Using addresses output from previous commands
npx hardhat verify <verifier_address> --network optimism
npx hardhat verify <attester_address> --network optimism
npx hardhat verify <resolver_address> --network optimism

# Set the PASSPORT_MULTISIG_ADDRESS in the .env
vim .env
npx hardhat run scripts/transferOwnership.ts --network optimism

# Add EAS schema uids
vim deployments/onchainInfo.json

# Check in the updated deployments and .openzepplin files
git add .
git commit -m "feat(infra): added optimism deployment"
git push

# Move the deployments dir to the Passport repo
cd ../passport
rm -rf deployments
cp -r ../eas-proxy/deployments ./

# Add chain ID 0xa to NEXT_PUBLIC_ACTIVE_ON_CHAIN_PASSPORT_CHAINIDS
# and NEXT_PUBLIC_POSSIBLE_ON_CHAIN_PASSPORT_CHAINIDS
vim app/.env
```

_[← Back to README](..#other-topics)_
