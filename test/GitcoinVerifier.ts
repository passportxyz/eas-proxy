import { runVerifierTests } from "./helpers/verifierTests";

runVerifierTests("GitcoinVerifier", async (contract, issuer, attester) => {
  await contract.initialize(issuer, attester);
});
