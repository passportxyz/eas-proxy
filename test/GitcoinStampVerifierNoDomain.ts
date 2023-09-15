import { verifyTypedData } from "ethers";
// import { ethers } from "hardhat";
// import { PromiseOrValue } from "../typechain-types/common";
import { expect } from "chai";
// import { GitcoinStampVerifier__factory } from "../typechain-types";
import * as DIDKit from "@spruceid/didkit-wasm-node";

const key =
  '{"kty":"EC","crv":"secp256k1","x":"PdB2nS-knyAxc6KPuxBr65vRpW-duAXwpeXlwGJ03eU","y":"MwoGZ08hF5uv-_UEC9BKsYdJVSbJNHcFhR1BZWer5RQ","d":"z9VrSNNZXf9ywUx3v_8cLDhSw8-pvAT9qu_WZmqqfWM"}';
const credentialInput = {
  type: ["VerifiableCredential"],
  issuer: "did:ethr:0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e",
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/vc/status-list/2021/v1",
  ],
  issuanceDate: "2023-09-15T16:16:20.527Z",
  expirationDate: "2023-12-14T17:16:20.527Z",
  credentialSubject: {
    id: "did:pkh:eip155:1:0x0636F974D29d947d4946b2091d769ec6D2d415DE",
    hash: "v0.0.0:VC1vOVLxD3X29DYfyyT58AA+j0rC5vkXNflCA94iApA=",
    "@context": {
      hash: "https://schema.org/Text",
      provider: "https://schema.org/Text",
      customInfo: "https://schema.org/Thing",
      metaPointer: "https://schema.org/URL",
    },
    provider: "FirstEthTxnProvider",
    customInfo: {},
  },
};

async function generateCredentials() {
  const verificationMethod = await DIDKit.keyToVerificationMethod("ethr", key);
  const options = {
    verificationMethod,
    type: "EthereumEip712Signature2021",
    // domain: {
    //   name: "Eip712Method2021",
    // },
  };

  const preparedCredential = await DIDKit.prepareIssueCredential(
    JSON.stringify(credentialInput, undefined, 2),
    JSON.stringify(options, undefined, 2),
    key
  );

  const issuedCredential = await DIDKit.issueCredential(
    JSON.stringify(credentialInput, undefined, 2),
    JSON.stringify(options, undefined, 2),
    key
  );

  const preppedCredential = JSON.parse(preparedCredential) as any;
  const signedCredential = JSON.parse(issuedCredential) as any;
  return { preppedCredential, signedCredential };
}

describe.only("Verifying EIP712 Credentials", () => {
  it("should verify a credential using ethers", async () => {
    const { preppedCredential, signedCredential } = await generateCredentials();
    const standardizedTypes = preppedCredential.signingInput.types;
    delete standardizedTypes.EIP712Domain;

    const didkitVerification = await DIDKit.verifyCredential(
      JSON.stringify(signedCredential),
      JSON.stringify({
        proofPurpose: "assertionMethod",
      })
    );

    const signerAddress = verifyTypedData(
      preppedCredential.signingInput.domain,
      standardizedTypes,
      signedCredential,
      signedCredential.proof.proofValue
    );
    const signedCredIssuer = signedCredential.issuer.split(":").pop();

    expect(signerAddress.toLowerCase()).to.be.equal(signedCredIssuer);
  });
});
