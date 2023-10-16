# How to Decode Passport and Score Attestations Onchain


## Intro

The purpose of this document is to provide instructions on how to decode Passport and Score attestions onchain.

For details on the EAS schema used to store Gitcoin Passports onchain, please see: [Onchain Passport Attestation](https://github.com/gitcoinco/eas-proxy/blob/main/docs/01-onchain-passport-attestation.md)

## Explanation of the Smart Contracts Involved

In order to understand how Passport and Passports Scores exist onchain, take a read of [Bringing Passport Data Onchain](https://github.com/gitcoinco/eas-proxy/blob/main/docs/00-onchain-data.md#bringing-passport-data-onchain).

In order to query Passport attestations, we call on the `getPassport` function from the `GitcoinPassportDecoder` smart contract, which creates instances of both the `GitcoinResolver` and the interface of the EAS smart contracts. 

Within the `getPassport` function call, the `userAttestations` function from `GitcoinResolver` is called in order to pull in the UID of the desired Passport attestation. Using this UID, the `getAttestation` function from EAS is called in order to pull in the attestation data.

This data is then decoded and iterated over to pull out the stamp name, issuance dates, expiration dates, and hashes for each individual stamp, and returned as an array of structs for your final use.

## Query a Decoded Passport via a Block Explorer

*We'll be using the Base Goerli ("0x14a33") block explorer to query a decoded Passport in this example.*

You'll need the following items copied and pasted somewhere handy, all located here (except for the wallet address to be queried): [onchaininfo.json](https://github.com/gitcoinco/eas-proxy/blob/main/deployments/onchainInfo.json)
- `GitcoinPassportDecoder` proxy contract address for Base Goerli
- `EAS` contract address for Base Goerli
- `GitcoinResolver` proxy contract address for Base Goerli
- wallet address of the Passport you'd like to query
- `schemaUID` of the Passport

<!-- TODO: Add images for each step -->
1. Visit the [Base Goerli block explorer](https://goerli.basescan.org/)
2. Paste the `GitcoinPassportDecoder` proxy contract address into the search bar
3. Click on the Contract tab
4. Click on the Write as Proxy button
5. Connect your wallet
5. Initialize the `EAS` contract by adding its address to the `setEASAddress` function
6. Initialize the `GitcoinResolver` contract by adding its address to the `setGitcoinResolver` function
7. Next, click on the Read as Proxy button
8. Click on the `getPassport` accordion
9. Add the `userAddress` and `schemaUID` to the `getPassport` form and query it. 
<!-- A (TODO: UPDATE THIS) will be return -->

## Query a Decoded Passport via a Script

In order to query one or more Passports, you can create a script using a library like `ethers.js`. In this example, we'll be using `ethers.js` and `node`.

## FAQs
