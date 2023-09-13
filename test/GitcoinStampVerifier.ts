import { Signature } from "ethers";
import { ethers } from "hardhat";
import { PromiseOrValue } from "../typechain-types/common";
import { expect } from "chai";
import { GitcoinStampVerifier__factory } from "../typechain-types";

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

  normalizedCredentialContext["customInfo"] =
    credential.credentialSubject["@context"]["customInfo"];
  normalizedCredentialContext["_hash"] =
    credential.credentialSubject["@context"]["hash"];
  normalizedCredentialContext["metaPointer"] =
    credential.credentialSubject["@context"]["metaPointer"];
  normalizedCredentialContext["provider"] =
    credential.credentialSubject["@context"]["provider"];

  normalizedSubject["_context"] = normalizedCredentialContext;

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
  type: ["VerifiableCredential"],
  proof: {
    type: "EthereumEip712Signature2021",
    created: "2023-09-13T21:25:13.163Z",
    "@context": "https://w3id.org/security/suites/eip712sig-2021/v1",
    proofValue:
      "0x1139ee60eab7323a7ec73427ece720642e93b1e29ab854c6942fc04d1b08aeaa16cd6e158f721eec74d115fb8e3ea29b0dd1f4b37167325e67a905bd5abc72431b",
    eip712Domain: {
      types: {
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
            name: "proofValue",
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
        Context: [
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
          {
            name: "credentialStatus",
            type: "CredentialStatus",
          },
        ],
        EIP712Domain: [
          {
            name: "name",
            type: "string",
          },
          {
            name: "version",
            type: "string",
          },
        ],
        CredentialStatus: [
          {
            name: "id",
            type: "string",
          },
          {
            name: "type",
            type: "string",
          },
          {
            name: "statusPurpose",
            type: "string",
          },
          {
            name: "statusListIndex",
            type: "string",
          },
          {
            name: "statusListCredential",
            type: "string",
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
            name: "metaPointer",
            type: "string",
          },
          {
            name: "hash",
            type: "string",
          },
          {
            name: "@context",
            type: "Context",
          },
        ],
      },
      domain: {
        name: "Gitcoin Passport Verifiable Credential of Stamp data",
        version: "0",
      },
      primaryType: "Document",
    },
    proofPurpose: "assertionMethod",
    verificationMethod:
      "did:ethr:0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e#controller",
  },
  issuer: "did:ethr:0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e",
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/vc/status-list/2021/v1",
  ],
  issuanceDate: "2023-09-13T21:25:13.150Z",
  expirationDate: "2023-12-12T22:25:13.150Z",
  credentialSubject: {
    id: "did:pkh:eip155:1:0xC79ABB54e4824Cdb65C71f2eeb2D7f2db5dA1fB8",
    hash: "v0.0.0:0xRiw2BMLTItJg8iicfNTLlzQumcF37sKIifVthEx9Y=",
    "@context": {
      hash: "https://schema.org/Text",
      provider: "https://schema.org/Text",
      customInfo: "https://schema.org/Thing",
      metaPointer: "https://schema.org/URL",
    },
    provider: "EthGTEOneTxnProvider",
  },
};

describe.only("Signature for GitcoinStampVerifier", () => {
  it("should split the signature into r, s, v", () => {
    const signature = Signature.from(sampleCredential.proof.proofValue);
    const { r, s, v } = signature;
    expect(r).to.be.equal(
      "0x1139ee60eab7323a7ec73427ece720642e93b1e29ab854c6942fc04d1b08aeaa"
    );
    expect(s).to.be.equal(
      "0x16cd6e158f721eec74d115fb8e3ea29b0dd1f4b37167325e67a905bd5abc7243"
    );

    expect(v).to.be.equal(27);
  });
  it("should normalize the credential for writing on chain", () => {
    const normalizedCredential = normalizeDIDCredential(sampleCredential);

    expect(normalizedCredential._context).to.be.deep.equal([
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/vc/status-list/2021/v1",
    ]);
  });
  it("should verify the VC signature on chain", async () => {
    const normalizedCredential = normalizeDIDCredential(
      sampleCredential
    ) as DocumentStruct;
    const [signer] = await ethers.getSigners();

    const GitcoinStampVerifier = await ethers.getContractFactory(
      "GitcoinStampVerifier"
    );

    const gitcoinStampVerifier = await GitcoinStampVerifier.deploy();

    await gitcoinStampVerifier.initialize(
      "0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e"
    );
    const signature = Signature.from(sampleCredential.proof.proofValue);
    const { r, s, v } = signature;

    debugger;
    const tx = await gitcoinStampVerifier.verifyStampVc(
      normalizedCredential,
      v,
      r,
      s
    );

    expect(tx).to.be.true;
  });
});
