import { runVerifierTests } from "./helpers/verifierTests";

runVerifierTests("GitcoinVerifier", async (contract, issuer, attester, _passportSchema, _scoreSchema, feeAddress) => {
  await contract.initialize(issuer, attester, feeAddress);
});
