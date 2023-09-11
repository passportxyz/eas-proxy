# Onchain Stamp Attestation

## Intro

🛑
_This is not being used with the Gitcoin Passport app and is not fully implemented,
the full Passport is written to the chain instead. See
[Onchain Passport Attestation](./01-onchain-passport-attestation.md)_
🛑

_[← Back to README](..#other-topics)_

The purpose of this document is to describe:

- the EAS schema that can be used to store Gitcoin Passports Stamps onchain
- how to discover all of a recipients stamp attestations onchain
- how to use the stamps in integrations, for example how to score a Passport

For details about the process of bringing Passport data in chain please see: [Onchain Data](./00-onchain-data.md).

## EAS Schema

Following is the EAS schema to store a Passport onchain

```js
new SchemaEncoder("bytes32 provider, bytes32 hash, uint64 issuanceDate");
```

**provider** - this field contains the hash of the providername of this stamp
**hash** - the stamp's hash (the unique identifier)
**issuanceDates** - the date when the stamp was issued. This might differ from the creation date in the EAS attestation

## GitcoinStampResolver

The purpose of the `GitcoinStampResolver` is to enable one to discover all of a recipient's stamps.
This resolver will keep track of the latest stamp attestation for a particular recipient and provider using a nested mapping:

    recipient => (provider => attestation UUID)

In solidity this would translate to:

    mapping(address => (bytes32 => bytes32)) public passports;

Given this structure, we would be able to retrieve the UUID for any Passport attestation of a particular recipient.

## Updating Passport

Whenever the user makes changes to their Passport (deleting, renewing or claiming new stamps) the following actions need to be taken in order to keep the onchain Passport up to date:

- claiming new stamps - write the new stamps as attestations onchain
- refreshing stamps
  - write the new stamps as attestations onchain, this will overwrite the previous stamp
  - optionally revoke the older stamp
- delete stamps
  - ⁉️⁉️⁉️ TODO: clarify how to properly handle this
    - revoke the older stamp
    - delete the stamp from the resolver

**_Open Points_**

- shall we revoke stamps?

## Integrations

### How to Score a Passport

**_Open Points_**

- provide an example integration

_[← Back to README](..#other-topics)_
