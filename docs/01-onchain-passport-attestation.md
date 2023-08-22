# Onchain Passport Attestation

## Intro

The purpose of this document is to describe the EAS schema used to store Gitcoin
Passports onchain, how to get a users Passport attestation and how to use it in
integrations (for example how to score a Passport).

For details about the process of bringing Passport data on chain please see:
[Onchain Data](./00-onchain-data.md).

## Passport EAS Schema

Following is the EAS schema to store a Passport onchain.
This will allow capturing a snapshot of a users Passport onchain.

```solidity
new SchemaEncoder(
  "uint256[] providers, bytes32[] hashes, uint64[] issuanceDates, uint64[] expirationDates, uint16 providerMapVersion"
);
```

### Fields

#### providers

- this field shall indicate which stamps (i. e. which providers) a user has in
  their Passport. This field is declared as an array of `uint256` but it shall be
  used as a array of bits, meaning:
- we will use an ordered list of providers, and we will assign each of the
  providers a position in the bytes32 array and a bit, for example:
  - position 0, bit 0 (`0x0000000000000001`): Brightid
  - position 0, bit 1 (`0x0000000000000002`): unityStakingBronze
  - position 0, bit 2 (`0x0000000000000004`): CommunityStakingGold
  - position 0, bit 3 (`0x0000000000000008`): CommunityStakingSilver
  - position 0, bit 4 (`0x0000000000000010`): Coinbase
  - position 0, bit 5 (`0x0000000000000020`): Discord
- we will set the corresponding bit of the element in the `providers` field to
  0, if a user does have the stamp for the providers who is assigned that bit

#### hashes

- this field shall record the individual hashes for each stamp a user owns:
- this will be an ordered list, the hashes will be written in the order of the
  providers as defined for the `providers` field (i.e. hashes[0] corresponds
  to the provider at the rightmost bit)
- this field will only record the hashes for the stamps that a user owns, meaning
  we will skip any elements where the provider bit is set to 0 in the `providers`
  field

#### issuanceDates

- (unix timestamp - the number of seconds since epoch, the beginning of
  January 1, 1970, UTC) individual issuance dates for the stamps. Similar to the
  hashes field, this is an ordered array. The issuance date can be different form
  the EAS creation timestamp.

#### expirationDates

- (unix timestamp) individual expiration dates for the stamps. Similar to the
  hashes field, this is an ordered array, containing th expiration date for each
  stamp.

Considering the list of providers above if a user has the `BrightId`,
`CommunityStakingSilver` and `Discord` stamps, their attestation will look like:

#### providerMapVersion

- this field will be used to indicate the version of the provider map used to
  encode the `providers` field. This will allow us to version the provider map
  if there are a large amount of stamps that need to be replaced/removed in the
  future. If new providers are only added, the providerMapVersion does not change.

```json
{
  "providers": ["12983612785124"],
  "hashes": ["0x0000000000000001", "0x0000000000000002", "0x0000000000000003"],
  "issuanceDates": ["123456789", "123456789", "123456789"],
  "expirationDates": ["123456789", "123456789", "123456789"]
}
```

The 3 bits corresponding to each position of the providers will be set to 1 in
the first element in providers, and we record the 3 hashes in the `hashes` field.

## Score EAS Schema

Following is the EAS schema to store a score onchain.

```solidity
new SchemaEncoder(
  "uint256 score,uint32 scorer_id,uint8 score_decimals"
);
```

### Fields

#### score

The score as an unsigned integer, similar to an ERC-20 balance

#### scorer_id

ID of the scorer that issued this score.

#### score_decimals

Number of decimals in **score**, similar to an ERC-20 balance

## GitcoinResolver

For our use-case it is important that given an ETH address of a user, we are able
to determine all the stamps that the user owns.
The EAS smart contract does not offer this functionality.
However, we can create a resolver smart contract that stores the **_latest_**
Passport attestation for a particular recipient using a particular schema:

```solidity
recipient => schema UUID => attestation UUID
```

In solidity this would translate to:

```solidity
mapping(address => mapping(bytes32 => bytes32)) public userAttestations;
```

Given this structure, we would be able to retrieve the UUID for the latest
Passport attestation of a particular recipient.

As also mentioned in [On Chain Data](./00-onchain-data.md), the resolver smart
contract will:

- only allow calls from a trusted EAS smart contract
- only accept data coming from a trusted attester

## Updating Passport

A Passport attestation will always record a snapshot of a user's Passport.
Whenever the user makes changes to their Passport (deleting, renewing or claiming
new stamps) in the Passport App, a new attestation needs to be created in EAS in
order to record the latest state of the Passport onchain.
Optionally, the previous attestation can be revoked.

## Integrations

### How to Score a Passport Onchain

Please see the implementation of the
[GitcoinScorer](../contracts/GitcoinScorer.sol) smart contract for an example of
how to load and check a user's Passport attestation.

### How to Load a Passport/Score Off-Chain

Please see the implementation of the
[onChainStamps utils](https://github.com/gitcoinco/passport/blob/main/app/utils/onChainStamps.ts)
file in the Passport app for an example of how to load a user's Passport and attestations.

_[← Back to README](..#other-topics)_
