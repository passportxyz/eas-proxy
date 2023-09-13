import { Signature } from "ethers";
import { ethers } from "hardhat";
import { PromiseOrValue } from "../typechain-types/common";
import { expect } from "chai";

export type ProofStruct = {
  _context: PromiseOrValue<string>;
  created: PromiseOrValue<string>;
  proofPurpose: PromiseOrValue<string>;
  _type: PromiseOrValue<string>;
  verificationMethod: PromiseOrValue<string>;
};

export type CredentialSubjectStruct = {
  _hash: PromiseOrValue<string>;
  id: PromiseOrValue<string>;
  provider: PromiseOrValue<string>;
};

export type DocumentStruct = {
  _context: string[];
  credentialSubject: CredentialSubjectStruct;
  expirationDate: PromiseOrValue<string>;
  issuanceDate: PromiseOrValue<string>;
  issuer: PromiseOrValue<string>;
  proof: ProofStruct;
  _type: PromiseOrValue<string>[];
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
  customInfo: {
    [key: string]: string;
  };
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

  normalizedSubject["id"] = credential.credentialSubject.id;
  normalizedSubject["provider"] = credential.credentialSubject.provider;
  normalizedSubject["_hash"] = credential.credentialSubject.hash;

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

const sampleCredential = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/vc/status-list/2021/v1",
  ],
  type: ["VerifiableCredential"],
  credentialSubject: {
    id: "did:pkh:eip155:1:0xC79ABB54e4824Cdb65C71f2eeb2D7f2db5dA1fB8",
    "@context": {
      customInfo: "https://schema.org/Thing",
      hash: "https://schema.org/Text",
      metaPointer: "https://schema.org/URL",
      provider: "https://schema.org/Text",
    },
    provider: "githubAccountCreationGte#90",
    customInfo: {},
    hash: "v0.0.0:KkYaKn2GaF55a3y/n6myG9kfrpQPHW5DnhhzO9APTGI=",
  },
  issuer: "did:ethr:0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e",
  issuanceDate: "2023-09-13T02:12:37.417Z",
  proof: {
    type: "EthereumEip712Signature2021",
    created: "2023-09-13T02:12:37.422Z",
    "@context": "https://w3id.org/security/suites/eip712sig-2021/v1",
    proofValue:
      "0x17d27bfcd590ce7bd26b1c6ebd953d9f390f2089279403733acf874366f768697dab73a4fdb1ea380a0feea129b521245d1b2ffcd69b4e2586cda64b3c7c770a1c",
    proofPurpose: "assertionMethod",
    verificationMethod:
      "did:ethr:0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e#controller",
  },
  expirationDate: "2023-12-12T03:12:37.417Z",
};

describe.only("Signature for GitcoinStampVerifier", () => {
  it("should split the signature into r, s, v", () => {
    const signature = Signature.from(sampleCredential.proof.proofValue);
    const { r, s, v } = signature;
    expect(r).to.be.equal(
      "0x17d27bfcd590ce7bd26b1c6ebd953d9f390f2089279403733acf874366f76869"
    );
    expect(s).to.be.equal(
      "0x7dab73a4fdb1ea380a0feea129b521245d1b2ffcd69b4e2586cda64b3c7c770a"
    );

    expect(v).to.be.equal(28);
  });
  it("should normalize the credential for writing on chain", () => {
    const normalizedCredential = normalizeDIDCredential(sampleCredential);
    debugger;
    expect(normalizedCredential._context).to.be.deep.equal([
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/vc/status-list/2021/v1",
    ]);
  });
});
