# Deployment with Verax

The basics are in the [previous section](./03-new-deployment.md), please review this first.

When we want to support Verax on a chain, we will deploy contracts which
write to both Verax and EAS.

These are the deployment steps:

1. Run `deployAttester`
2. Run `deployResolver`
3. Run `deployVerifierWithVeraxPortal`, which deploys both the
   GitcoinVeraxPortal and GitcoinVerifierWithVeraxPortal
4. Use the resolver's `addToAllowlist` function to allowlist the portal address
5. Deploy the schemas using Verax's Schema Registry on Etherscan
6. Register the portal using Verax's Portal Registry on Etherscan
7. Deploy the EAS schemas as usual
8. Use the portal's `addSchemaMapping` function to register the mapping
   from each EAS schema to the equivalent Verax schema
9. Use the attester's `addVerifier` to register the verifier

The onchainDeployments file will contain the following additional fields:

```json
{
    "...",
    "Verax": {
      "AttestationRegistry": {
        "address": "/* Must be manually set, scripts will instruct you to do so */"
      },
      "schemas": {
        "passport": {
          "uid": "/* Manually set for documentation purposes */"
        },
        "score": {
          "uid": "/* Manually set for documentation purposes */"
        }
      }
    },
    "GitcoinVeraxPortal": {
      "address": "/* Automatically set by the scripts */"
    }
}
```

_[← Back to README](..#other-topics)_
