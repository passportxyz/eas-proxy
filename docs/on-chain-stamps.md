# Bringing Passport Data On-Chain

In order to store passport (and potentially passport scorer data) on-chain we have chosen the [Ethereum Attestation Service](https://attest.sh/) (EAS). Stamps (and in the future potentially also scores and other data) will be written as attestations on-chain, using the EAS protocol.

EAS is a protocol that allows storing attestations on chain.

How does this work?

1. You define a schema for your attestation. Each schema is identified by a unique UUID.
2. Once the schema was created, you can write data to it by calling one of the EAS smart contracts functions, like `attest(AttestationRequest calldata request)` (see [https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/IEAS.sol#L148-L169](https://github.com/ethereum-attestation-service/eas-contracts/blob/master/contracts/IEAS.sol#L148-L169) )
3. The following data will be registered in the attestion:
   1. the attester (this will be the`msg.sender`)
   2. the recipient (an ETH address)
   3. other data like: creation date, expiration, is \_revocable, a referenced attestation

The Passport concept for bringing data on-chain contains the following:

- GitcoinAttester - this is a smart contract that is designed to act as a proxy. Its purpose is to relay any potential attestations, coming from trusted resources, to the EAS smart contract so that it is registered as the attester.
- GitcoinVerifier - this is designed to be trusted resource for the Attester. This smart contract will be called from the Passport App ( [https://passport.gitcoin.co](https://passport.gitcoin.co/) ), whenever a user desires to bring their stamps on-chain.

For the moment there is only 1 GitcoinVerifier smart contracts available (and only 1 will be deployed), but it is possible that in the future more verifier smart contracts will be created, and added to the allowlist in GitcoinAttester.

Both smart contracts implement access control, by extending from OpenZeppelins `Ownable`.

None of the smart contracts are upgradeable or pauseable

# GitcoinAttester

Here are the main features:

- the attester is an own able smart contract
- It implements an function that will forward attestation data to the EAS smart contract: `function submitAttestations(MultiAttestationRequest[] calldata multiAttestationRequest)`
- only registered verifiers are allowed to call the `submitAttestations` function
- the registration list can be managed using the following function (both of which can only be invoked by the owner):
  - `function addVerifier(address _verifier)` - add a new verifier
  - `function removeVerifier(address _verifier)` - remove an existing verifier
- allows settings the address of the EAS smart contract to which data will be forwarded (this function is also only invocable by the owner): `function setEASAddress(address _easContractAddress)`

# GitcoinVerifier

The purpose of the verifier is to validate the passport data that a user wants to bring on-chain. The validation is performed by check the [EIP-712](https://eips.ethereum.org/EIPS/eip-712) signature for the data that is sent in by the passport app.
The EIP-712 signature will be created by the **Passport IAM Service** which is the same service that issues the stamps (verifiable credentials) for the Passport applications.

The flow when the user triggers the process to bring his data on-chain from the Passport app is the following:

1. the Passport App creates a payload with the data to be written on-chain (a list of stamps) and sends this to the IAM Service
2. The IAM service validates that data and signs it with the EIP-712 procedure
3. The Passport App will call the `GitcoinVerifier` function `verifyAndAttest`
4. The signature of the data will be validated, and validation passes the `function submitAttestations(MultiAttestationRequest[] calldata multiAttestationRequest)` in the `GitcoinAttester` will be called to write the data to the EAS protocol

## Open points

Following items are in our backlog:

- GitcoinVerifier - will be made ownable
- withdraw function (to be called by owner only) is missing
- allow more generic payloads, to include scores as well as stamps
- make the Verifier & Attester upgradeable & pausable

## Fee

It was a requirement that a small fee shall be collected by the verifier for each data set that is written on-chain. For this purposed when the `verifyAndAttest` method is called, it will check if the expected amount (in ETH) has been sent to the smart contract, and will revert with the message “_Insufficient fee_” if this is not the case.

The amount of the fee is determined by the IAM server, and it is the equivalent of 2 USD in ETH.
The fee is part of the data structure that is signed with the EIP-712 procedure, so that it cannot be changed during the process of writing stamps on-chain.

## Replay protection

In order to prevent against replay attacks, the `Passport` structure that is passed in the `verifyAndAttest` function call, also must contain a `nonce`.

This nonce is unique per recipient. The nonce will start from 0 and the correct nonce, and it will be incremented by 1 for each each call that is made to the `verifyAndAttest` function for the specified recipient.

The `Passport` structure must contain the correct (the next) nonce for the recipient, in order for the call to `verifyAndAttest` to get through. It will be reverted otherwise.
