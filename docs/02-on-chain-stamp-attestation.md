
# Intro

The purpose of this document is to describe:
- the EAS schema that can be used to store Gitcoin Passports Stamps on-chain
- how to discover all of a recipients stamp attestations on-chain
- how to use the stamps in integrations, for example how to score a passport

For details about the process of bringing passport data in chain please see: [On Chain Data](./00-on-chain-data.md).

# EAS Schema
Following is the EAS schema to store a passport on-chain 

```js
new SchemaEncoder(
   "bytes32 provider, bytes32 hash, uint64 issuanceDate"
);
```

**provider** - this field contains the hash of the providername of this stamp
**hash** - the stamp's hash (the unique identifier)
**issuanceDates** - the date when the stamp was issued. This might differ from the creation date in the EAS attestation


# GitcoinStampResolver
The purpose of the `GitcoinStampResolver` is to enable one to discover all of a recipient's stamps.
This resolver will keep track of the latest stamp attestation for a particular recipient and provider using a nested mapping:

    recipient => (provider => attestation UUID)

In solidity this would translate to:

    mapping(address => (bytes32 => bytes32)) public passports;

Given this structure, we would be able to retrieve the UUID for any passport attestation of a particular recipient.


# Updating passport
Whenever the user makes changes to their passport (deleting, renewing or claiming new stamps) the following actions need to be taken in order to keep the on-chain passport up to date:
- claiming new stamps - write the new stamps as attestations on-chain
- refreshing stamps
    - write the new stamps as attestations on-chain, this will overwrite the previous stamp
    - optionally revoke the older stamp
- delete stamps
    - ⁉️⁉️⁉️ TODO: clarify how to properly handle this
        - revoke the older stamp
        - delete the stamp from the resolver
    

***Open Points***
- shall we revoke stamps?


# Integrations
## How to Score a Passport

***Open Points***
- provide an example integration

