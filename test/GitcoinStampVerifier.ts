import { Signature } from "ethers";
import { ethers } from "hardhat";
import { PromiseOrValue } from "../typechain-types/common";
import { expect } from "chai";
import { GitcoinStampVerifier__factory } from "../typechain-types";
import * as DIDKit from "@spruceid/didkit-wasm-node";

const key =
  '{"kty":"EC","crv":"secp256k1","x":"PdB2nS-knyAxc6KPuxBr65vRpW-duAXwpeXlwGJ03eU","y":"MwoGZ08hF5uv-_UEC9BKsYdJVSbJNHcFhR1BZWer5RQ","d":"z9VrSNNZXf9ywUx3v_8cLDhSw8-pvAT9qu_WZmqqfWM"}';

export type ProofStruct = {
  _context: PromiseOrValue<string>;
  _type: PromiseOrValue<string>;
  proofPurpose: PromiseOrValue<string>;
  // proofValue?: PromiseOrValue<string>;
  verificationMethod: PromiseOrValue<string>;
  created: PromiseOrValue<string>;
};

export type CredentialSubjectContext = {
  customInfo: string;
  _hash: string;
  metaPointer: string;
  provider: string;
};

// export type CustomInfoStruct = {
//   description: string;
// };

export type CredentialSubjectStruct = {
  id: PromiseOrValue<string>;
  _context: CredentialSubjectContext;
  provider: PromiseOrValue<string>;
  // customInfo: CustomInfoStruct;
  _hash: PromiseOrValue<string>;
};

export type DocumentStruct = {
  _context: string[];
  _type: PromiseOrValue<string>[];
  credentialSubject: CredentialSubjectStruct;
  issuer: PromiseOrValue<string>;
  issuanceDate: PromiseOrValue<string>;
  proof: ProofStruct;
  expirationDate: PromiseOrValue<string>;
};

export interface DIDCredential {
  "@context": string[];
  type?: string[];
  credentialSubject: CredentialSubject;
  issuer: string;
  issuanceDate: string;
  proof: Proof;
  expirationDate: string;
}
export interface CredentialSubject {
  id: string;
  provider: string;
  hash: string;
  // customInfo: {
  //   description: string;
  // };
  "@context": {
    customInfo: string;
    hash: string;
    metaPointer: string;
    provider: string;
  };
}
export interface Proof {
  type: string;
  created: string;
  "@context": string;
  proofValue: string;
  proofPurpose: string;
  verificationMethod: string;
}
export interface Eip712Domain {
  domain: Domain;
  primaryType: string;
  types: Types;
}
export interface Domain {
  name: string;
}
export interface Types {
  CredentialSubject?:
    | CredentialSubjectEntityOrDocumentEntityOrEIP712DomainEntityOrProofEntity[]
    | null;
  Document?:
    | CredentialSubjectEntityOrDocumentEntityOrEIP712DomainEntityOrProofEntity[]
    | null;
  EIP712Domain?:
    | CredentialSubjectEntityOrDocumentEntityOrEIP712DomainEntityOrProofEntity[]
    | null;
  Proof?:
    | CredentialSubjectEntityOrDocumentEntityOrEIP712DomainEntityOrProofEntity[]
    | null;
}
export interface CredentialSubjectEntityOrDocumentEntityOrEIP712DomainEntityOrProofEntity {
  name: string;
  type: string;
}

export const normalizeDIDCredential = (credential: DIDCredential) => {
  const normalizedCredential = {} as DocumentStruct;
  const normalizedSubject = {} as CredentialSubjectStruct;
  const normalizedProof = {} as ProofStruct;
  const normalizedCredentialContext = {} as {
    customInfo: string;
    _hash: string;
    metaPointer: string;
    provider: string;
  };

  normalizedSubject["id"] = credential.credentialSubject.id;
  normalizedSubject["provider"] = credential.credentialSubject.provider;
  normalizedSubject["_hash"] = credential.credentialSubject.hash;
  normalizedSubject["_context"] = normalizedCredentialContext;

  normalizedCredentialContext["customInfo"] =
    credential.credentialSubject["@context"]["customInfo"];
  normalizedCredentialContext["_hash"] =
    credential.credentialSubject["@context"]["hash"];
  normalizedCredentialContext["metaPointer"] =
    credential.credentialSubject["@context"]["metaPointer"];
  normalizedCredentialContext["provider"] =
    credential.credentialSubject["@context"]["provider"];

  normalizedProof["_context"] = credential.proof["@context"];
  normalizedProof["created"] = credential.proof.created;
  normalizedProof["proofPurpose"] = credential.proof.proofPurpose;
  normalizedProof["_type"] = credential.proof.type;
  normalizedProof["verificationMethod"] = credential.proof.verificationMethod;

  normalizedCredential["_context"] = credential["@context"];
  normalizedCredential["credentialSubject"] = normalizedSubject;
  normalizedCredential["expirationDate"] = credential.expirationDate;
  normalizedCredential["issuanceDate"] = credential.issuanceDate;
  normalizedCredential["issuer"] = credential.issuer;
  normalizedCredential["proof"] = normalizedProof;

  if (credential.type) {
    normalizedCredential["_type"] = credential.type;
  }

  return normalizedCredential;
};

const issuer = DIDKit.keyToDID("ethr", key);
const credentialInput = {
  type: ["VerifiableCredential"],
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/vc/status-list/2021/v1",
  ],
  issuer,
  issuanceDate: "2023-09-14T11:59:35.821Z",
  expirationDate: "2023-12-13T12:59:35.821Z",
  credentialSubject: {
    "@context": {
      customInfo: "https://schema.org/Thing",
      hash: "https://schema.org/Text",
      metaPointer: "https://schema.org/URL",
      provider: "https://schema.org/Text",
    },
    id: "did:pkh:eip155:1:0xC79ABB54e4824Cdb65C71f2eeb2D7f2db5dA1fB8",
    provider: "FirstEthTxnProvider",
    // metaPointer: "undefined",
    hash: "v0.0.0:HLEH/2c+EIFqSwYbiYiCK1dGVH17mVbA23Ez5c7kr/Q=",
  },
};

const options = {
  type: "EthereumEip712Signature2021",
  eip712Domain: {
    domain: {
      name: "GitcoinPassportStampVerifiableCredential",
    },
    types: {
      Document: [
        {
          name: "@context",
          type: "string[]",
        },
        {
          name: "type",
          type: "string[]",
        },
        {
          name: "issuer",
          type: "string",
        },
        {
          name: "issuanceDate",
          type: "string",
        },
        {
          name: "expirationDate",
          type: "string",
        },
        {
          name: "credentialSubject",
          type: "CredentialSubject",
        },
        {
          name: "proof",
          type: "Proof",
        },
      ],
      CredentialSubject: [
        {
          name: "id",
          type: "string",
        },
        {
          name: "provider",
          type: "string",
        },
        {
          name: "hash",
          type: "string",
        },
        {
          name: "@context",
          type: "CredentialSubjectContext",
        },
      ],
      CredentialSubjectContext: [
        {
          name: "customInfo",
          type: "string",
        },
        {
          name: "hash",
          type: "string",
        },
        {
          name: "metaPointer",
          type: "string",
        },
        {
          name: "provider",
          type: "string",
        },
      ],
      Proof: [
        {
          name: "@context",
          type: "string",
        },
        {
          name: "type",
          type: "string",
        },
        {
          name: "proofPurpose",
          type: "string",
        },
        {
          name: "verificationMethod",
          type: "string",
        },
        {
          name: "created",
          type: "string",
        },
      ],
      EIP712Domain: [
        { name: "name", type: "string" },
        // { name: "version", type: "string" },
      ],
    },
    primaryType: "Document",
  },
};

// rough outline of a VerifiableCredential
export type VerifiableCredential = {
  "@context": string[];
  type: string[];
  credentialSubject: {
    id: string;
    "@context": { [key: string]: string }[];
    hash?: string;
    provider?: string;
    address?: string;
    challenge?: string;
    metaPointer?: string;
  };
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  proof: {
    type: string;
    proofPurpose: string;
    verificationMethod: string;
    created: string;
    jws: string;
  };
};

describe.only("Signature for GitcoinStampVerifier", () => {
  let preppedCredential: any, signedCredential: any, normalizedCredential: any;
  beforeEach(async () => {
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

    preppedCredential = JSON.parse(preparedCredential) as any;
    signedCredential = JSON.parse(issuedCredential) as any;
    normalizedCredential = normalizeDIDCredential(signedCredential) as any;
  });
  it("should normalize the credential for writing on chain", () => {
    expect(normalizedCredential._context).to.be.deep.equal([
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/vc/status-list/2021/v1",
    ]);
  });
  it("should verify the VC signature on chain", async () => {
    const [signer] = await ethers.getSigners();

    const GitcoinStampVerifier = await ethers.getContractFactory(
      "GitcoinStampVerifier"
    );

    const gitcoinStampVerifier = await GitcoinStampVerifier.deploy();

    await gitcoinStampVerifier.initialize(
      "0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e"
    );

    const standardizedTypes = preppedCredential.signingInput.types;

    const signature = Signature.from(signedCredential.proof.proofValue);

    const tx = await gitcoinStampVerifier.verifyStampVc(
      normalizedCredential,
      signedCredential.proof.proofValue
    );

    expect(tx).to.be.true;
  });
  it("sign and verify the VC using ethers", async () => {
    const standardizedTypes = preppedCredential.signingInput.types;
    delete standardizedTypes.EIP712Domain;

    const signerAddress = ethers.verifyTypedData(
      preppedCredential.signingInput.domain,
      standardizedTypes,
      signedCredential,
      signedCredential.proof.proofValue
    );

    const signedCredIssuer = signedCredential.issuer.split(":").pop();

    expect(signerAddress.toLowerCase()).to.be.equal(signedCredIssuer);
  });
});
