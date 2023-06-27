
# Intro

The purpose of this document is to describe the EAS schema used to store Gitcoin Passports on-chain, how to get a users passport attestation and how to use it in integrations (for example how to score a passport).

For details about the process of bringing passport data in chain please see: [On Chain Data](./00-on-chain-data.md).

# EAS Schema
Following is the EAS schema to store a passport on-chain.
This will allow capturing a snapshot of a users passport on-chain.

```js
new SchemaEncoder(
   "bytes32[] providers, bytes32[] hashes, uint64[] issuanceDates"
);
```

**providers** - this field shall indicate which stamps (i. e. which providers) a user has in his passport. This field is declared as an array of `bytes32` but it shall be used as a array of bits, meaning:
- we will use an ordered list of providers, and we will assign each of the providers a position in the bytes32 array and a bit, for example: 
    - position 0, bit 0 (`0x0000000000000001`): Brightid
    - position 0, bit 1 (`0x0000000000000002`): unityStakingBronze
    - position 0, bit 2 (`0x0000000000000004`): CommunityStakingGold
    - position 0, bit 3 (`0x0000000000000008`): CommunityStakingSilver
    - position 0, bit 4 (`0x000000000000000f`): Coinbase
    - position 0, bit 5 (`0x0000000000000010`): Discord
- we will set the coresponding bit of the element in the `providers` field to 0, if a user does have the stamp for the providers who is assigned that bit

**hashes** - this field shall record the individual hashes for each stamp a user owns:
- this will be an ordered list, the hashes will be writted in the order of the providers as defined for the `providers` field
- this field will only record the hashes for the stamps that a user owns, meaning we will skip any elements where the provider bit is set to 0 in the `providers` field
**issuanceDates** - this field shall record the individual issuance dates for the stamps. Similar to the hashes field, this is a ordered array, and it will contain the issuance dates for the users stamps


Considering the list of providers abovem if a user has the `BrightId`, `CommunityStakingSilver` and `Discord` stamps, his attestation will look like:
```json
{
    "providers": ["0x0000000000000019"],  
    "hashes": ["0x0000000000000001", "0x0000000000000002", "0x0000000000000003"],  
    "issuanceDates": ["123456789", "123456789", "123456789"],  
}
```
The 3 bits coresponding to each position of the providers will be set to 0 in the first element in providers, and we record the 3 hashes in the `hashes` field.

# GitcoinPassportResolver
For our use-case it is important that given an ETH address of a user, we are able to determine all the stamps that the user owns.
The EAS smart contract does not offer this functionality.
However we can create a resolver smart contract that stores the ***latest*** passport attestation for a particular recipient:

    recipient => attestation UUID

In solidity this would translate to:

    mapping(address => bytes32) public passports;

Given this structure, we would be able to retrieve the UUID for the latest passport attestation of a particular recipient.


# Updating passport
A passport attestation wil always record a snapshot of a users passport.
Whenever the user makes changes to his passport (deleting, renewing or claiming new stamps) in the Passport App, a new attestation needs to be created in EAS in order to record the latest state of the passport on-chain.
Optionally, the previous attestation can be revoked.


# Integrations
## How to Score a Passport

Please see the implementation of the GitcoinScorer [GitcoinScorer](../contracts/GitcoinScorer.sol) smart contract for an example of how to load and check a users passport attestation.

