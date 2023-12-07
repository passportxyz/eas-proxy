# Intro

The purpose of this document is to provide instructions on how to load and decode Passport and Score attestions onchain for a given ETH address. It also outlines the implementation considerations for the `GitcoinPassportDecoder` smart contract.

For details on the EAS schema used to store Gitcoin Passports onchain, please see: [Onchain Passport Attestation](./01-onchain-passport-attestation.md)

## GitcoinPassportDecoder

`GitcoinPassportDecoder` is introduced to make the retreival of the on-chain data (passports and scores) easier and more convenient. This smart contract is tracking the provider maps (the allocation of bits in the Passport Attestation provider array) and also provides helper methods to allow for the easy retreival of passport, credentials and scores.

The most relevant methods introduced by this smart contract are:

- `getPassport()` - returns a list of valid credentials for a given ETH address. The validity
- `getScore()` - returns a users valid score, as a 4-digit value. This function will read the users score first from the cache in the `GitcoinResolver` and fall back to reading the score from the EAS attestation. This method will revert with an error is a valid score is not found.
- `isHuman()` - returns a single boolean, indicating if the users score is below or above the minimum threshold. It uses `getScore()` to retreive the value that is compared against the threshold.

> **Note:** Even though at the time of vriting the Gitcoin EAS attestations do not have an expiration time, old attestations will be considered to be expired. The consensus for the maximum age of a attestation is 90 days (this is configurable in the smart contract using the `maxScoreAge` attribute). Attestations and scores in the cache older than this will be considered to be expired.
> This affects the functions `getScore()` and `isHuman()`.

## How to Decode Passport Stamp Attestations

### Explanation of the Smart Contracts Involved

In order to understand how Passports and Passports Scores exist onchain, take a read of [Bringing Passport Data Onchain](./00-onchain-data.md#bringing-passport-data-onchain).

In order to load the latest Passport or Score attestations from EAS, we need to perform the following steps:

#### Step 1: Get the attestation UID

In order to find the attestation UID that is owned by a given ETH address for a given schema (like the passport schema) we will need to use the `GitcoinResolver` as this plays the role of an 'indexer' and will store the latest attestation UID for a given schema and for a given recipient.

This means that knowing the schema UID (which will be attained internally) and an ETH address we can get the attestation UID for a users.

#### Step 2: Get the attestation

Having the attestaion UID from Step 1, we can just use the `getAttestation` method of the EAS smart contract to load a user's attestation.

#### Step 3: Decode the stamps attestation data

The schema of the passport attestation is documented in [Onchain Passport Attestation](./01-onchain-passport-attestation.md). In order to decode it one will need to use the `abi.decode` function as shown in the snippet below:

```sol
// Decode the attestion output
(providers, hashes, issuanceDates, expirationDates, providerMapVersion) = abi.decode(
  attestation.data,
  (uint256[], bytes32[], uint64[], uint64[], uint16)
);
```

#### Step 4: Load the stamp / VC data from the attestation

The format of the passport attestation (what each individual field contains) is described in the document [Onchain Passport Attestation](./01-onchain-passport-attestation.md).

In order to decode the stamps that are saved in a Passport attestation, one needs to understand and keep track of all the stamp providers.
To optimise for space and gas costs, the `providers` field has been used as a bit array, with each bit being assigned to a given provider.

But this bit map is not fixed, and can potentially change over time as some providers are removed and others are added to the providers of Gitcoin Passport.
This is why we need to track the versions of the provider map. This can be achieved in a simple mapping like:

```sol
mapping(uint32 => string[]) public providerVersions;
```

This is how the `providerVersions` shall be used:

- keep an array of strings (provider names) for each version
- each position in the array coresponds to 1 bit in the `providers` field in the attestation
- new providers can be added to any array in this map

This how the `providerVersions` is meant to be used:

- the current version used for pushing stamps onchain is typically the latest version present in this map
- adding new providers for the current version of the providers list can be done by simply appending new elements to the array
- removing providers from an array is not possible. When providers are removed from the Passport Application, then there are 2 ways to deal with this in the `providerVersions`:
  - keep the current version of the providers array, and the deprecated providers will simply not be written onchain any more (1 bit from the `providers` field of the attestation will be unused). This typically makes sense when there is only a small number of unused field
  - create a new `providers` list version. This makes sense if the number of unused bits in the `providers` field is higher and we want to reset this

## How to Decode Score Attestations

Score attestations are much simpler than Passport attestations. A Score attestation only contains 3 fields in its paylod:

- uint256 score
- uint32 scorer_id
- uint8 score_decimals

You can follow Steps 1 and Step 2 above to retrieve the attestation UID and score attestation.
In order to retreive a passport attestation, there are 2 options:

1. **Option A**: read from EAS and decode the attestation similar like for PAssport (see above)
2. **Option B**: read from the 'cache' that has been implemented in the `GitcoinResolver` smart contract

Given that the caching was introduced at a later point and not all scores written to EAS have been cached, we recommend the reading a users score:

1. use **Option B** (fast and gas efficient)
2. if **Option B** did not yield any result (`time` field is 0) then fallback to **Option A** as it is possible that the score you are looking for was not yet cached (it might have been issued before the cache has been introduced)

### Option A - read from EAS

#### Step 1: get the attestation UID from

You can read this from `GitcoinResolver`, see `Step 1` above

#### Step 2: get the attestation

Read the attestation from EAS, see `Step 2` above

#### Step 3: decode the attestation

Example how to decode a score attestation:

```sol
    uint256 score;
    uint32s score_id;
    uint8 decimals;
    (score, , decimals) = abi.decode(
      attestation.data,
      (uint256, uint32, uint8)
    );
```

### Option B - read from cache

In order to be able to retreive an score more quickly and cheaper, a cache was introduced in the `GitcoinResolver` contract that will store the score (as a 4 digit number), issuance date and expiration date. This can be retreived directly from a map for a given ETH address without the need for further lookups or decoding.

To retreive a cached score from the resolver simply call the `getCachedScore(my_address)` function and the `CachedScore` will be returned. The CachedScore struct looks as follows:

```sol
struct CachedScore {
  uint32 score; // compacted uint value 4 decimal places
  uint64 time; // issuance time
  uint64 expirationTime; // expiration time
}
```

The `getCachedScore` will return an empty struct if a cached value does not exist for a given ETH address. To check that a valid score was returned, check that the value of `time` attribute (issuance time) is not `0`.

_[← Back to README](..#other-topics)_

```

```
