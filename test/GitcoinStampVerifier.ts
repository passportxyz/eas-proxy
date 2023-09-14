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

const sampleCredential = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/vc/status-list/2021/v1",
  ],
  type: ["VerifiableCredential"],
  credentialSubject: {
    id: "did:pkh:eip155:1:0xC79ABB54e4824Cdb65C71f2eeb2D7f2db5dA1fB8",
    provider: "FirstEthTxnProvider",
    hash: "v0.0.0:HLEH/2c+EIFqSwYbiYiCK1dGVH17mVbA23Ez5c7kr/Q=",
    "@context": {
      customInfo: "https://schema.org/Thing",
      hash: "https://schema.org/Text",
      metaPointer: "https://schema.org/URL",
      provider: "https://schema.org/Text",
    },
  },
  issuer: "did:ethr:0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e",
  issuanceDate: "2023-09-14T11:29:41.676Z",
  proof: {
    "@context": "https://w3id.org/security/suites/eip712sig-2021/v1",
    type: "EthereumEip712Signature2021",
    proofPurpose: "assertionMethod",
    proofValue:
      "0x95a8ec9b47a747be0ebdc11787783a4830d5ac27d9601dd81dc8d933527f74ce70013dc6a3632783acd7608351405eb7fe5638892e217d3be76adc7ec4c296001c",
    verificationMethod:
      "did:ethr:0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e#controller",
    created: "2023-09-14T11:29:41.679Z",
    eip712Domain: {
      domain: {
        name: "Gitcoin Passport Verifiable Credential of Stamp data",
        version: "0",
      },
      primaryType: "Document",
      types: {
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
            type: "Context",
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
      },
    },
  },
  expirationDate: "2023-12-13T12:29:41.675Z",
};

const prepareCredential = {
  proof: {
    "@context": "https://w3id.org/security/suites/eip712sig-2021/v1",
    type: "EthereumEip712Signature2021",
    proofPurpose: "assertionMethod",
    verificationMethod:
      "did:ethr:0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e#controller",
    created: "2023-09-14T11:29:41.690Z",
    eip712Domain: {
      domain: {
        name: "Gitcoin Passport Verifiable Credential of Stamp data",
        version: "0",
      },
      primaryType: "Document",
      types: {
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
            type: "Context",
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
      },
    },
  },
  jwsHeader: null,
  signingInput: {
    types: {
      EIP712Domain: [
        {
          type: "string",
          name: "name",
        },
        {
          type: "string",
          name: "version",
        },
      ],
      CredentialSubject: [
        {
          type: "string",
          name: "id",
        },
        {
          type: "string",
          name: "provider",
        },
        {
          type: "string",
          name: "hash",
        },
        {
          type: "Context",
          name: "@context",
        },
      ],
      Context: [
        {
          type: "string",
          name: "customInfo",
        },
        {
          type: "string",
          name: "hash",
        },
        {
          type: "string",
          name: "metaPointer",
        },
        {
          type: "string",
          name: "provider",
        },
      ],
      Proof: [
        {
          type: "string",
          name: "@context",
        },
        {
          type: "string",
          name: "type",
        },
        {
          type: "string",
          name: "proofPurpose",
        },
        {
          type: "string",
          name: "proofValue",
        },
        {
          type: "string",
          name: "verificationMethod",
        },
        {
          type: "string",
          name: "created",
        },
      ],
      Document: [
        {
          type: "string[]",
          name: "@context",
        },
        {
          type: "string[]",
          name: "type",
        },
        {
          type: "string",
          name: "issuer",
        },
        {
          type: "string",
          name: "issuanceDate",
        },
        {
          type: "string",
          name: "expirationDate",
        },
        {
          type: "CredentialSubject",
          name: "credentialSubject",
        },
        {
          type: "Proof",
          name: "proof",
        },
      ],
    },
    primaryType: "Document",
    domain: {
      name: "Gitcoin Passport Verifiable Credential of Stamp data",
      version: "0",
    },
    message: {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://w3id.org/vc/status-list/2021/v1",
      ],
      credentialSubject: {
        "@context": {
          customInfo: "https://schema.org/Thing",
          hash: "https://schema.org/Text",
          metaPointer: "https://schema.org/URL",
          provider: "https://schema.org/Text",
        },
        hash: "v0.0.0:HLEH/2c+EIFqSwYbiYiCK1dGVH17mVbA23Ez5c7kr/Q=",
        id: "did:pkh:eip155:1:0xC79ABB54e4824Cdb65C71f2eeb2D7f2db5dA1fB8",
        provider: "FirstEthTxnProvider",
      },
      expirationDate: "2023-12-13T12:29:41.675Z",
      issuanceDate: "2023-09-14T11:29:41.676Z",
      issuer: "did:ethr:0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e",
      proof: {
        "@context": "https://w3id.org/security/suites/eip712sig-2021/v1",
        created: "2023-09-14T11:29:41.690Z",
        proofPurpose: "assertionMethod",
        type: "EthereumEip712Signature2021",
        verificationMethod:
          "did:ethr:0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e#controller",
      },
      type: ["VerifiableCredential"],
    },
  },
};

describe.only("Signature for GitcoinStampVerifier", () => {
  // it("should split the signature into r, s, v", () => {
  //   const signature = Signature.from(sampleCredential.proof.proofValue);
  //   const { r, s, v } = signature;
  //   expect(r).to.be.equal(
  //     "0xd4952bda469284acffc0d8b7980a73894d1420b148f61af4e25cec43f4127ec8"
  //   );
  //   expect(s).to.be.equal(
  //     "0x773bb203302d75ea5e8248b58a073a8cc2bb616fec1dbd817a074db1436466c0"
  //   );

  //   expect(v).to.be.equal(28);
  // });
  // it("should normalize the credential for writing on chain", () => {
  //   const normalizedCredential = normalizeDIDCredential(sampleCredential);

  //   expect(normalizedCredential._context).to.be.deep.equal([
  //     "https://www.w3.org/2018/credentials/v1",
  //     "https://w3id.org/vc/status-list/2021/v1",
  //   ]);
  // });
  // it("should verify the VC signature on chain", async () => {
  //   const normalizedCredential = normalizeDIDCredential(
  //     sampleCredential
  //   ) as DocumentStruct;
  //   const [signer] = await ethers.getSigners();

  //   const GitcoinStampVerifier = await ethers.getContractFactory(
  //     "GitcoinStampVerifier"
  //   );

  //   const gitcoinStampVerifier = await GitcoinStampVerifier.deploy();

  //   await gitcoinStampVerifier.initialize(
  //     "0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e"
  //   );

  //   const standardizedTypes = prepareCredential.signingInput.types;
  //   // @ts-ignore
  //   // delete standardizedTypes.EIP712Domain;

  //   const recoveredAddress = ethers.verifyTypedData(
  //     prepareCredential.proof.eip712Domain.domain,
  //     standardizedTypes,
  //     sampleCredential,
  //     sampleCredential.proof.proofValue
  //   );

  //   const issuerAddress = sampleCredential.issuer.split(":").pop();

  //   debugger;
  //   const signerIssuedCredential =
  //     recoveredAddress.toLowerCase() === issuerAddress;

  //   expect(signerIssuedCredential).to.be.true;
  //   const signature = Signature.from(sampleCredential.proof.proofValue);
  //   const { r, s, v } = signature;

  //   debugger;
  //   const tx = await gitcoinStampVerifier.verifyStampVc(
  //     normalizedCredential,
  //     v,
  //     r,
  //     s
  //   );

  //   expect(tx).to.be.true;
  // });
  it("sign and verify the VC using ethers", async () => {
    const issuer = DIDKit.keyToDID("ethr", key);
    const credentialInput = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://w3id.org/vc/status-list/2021/v1",
      ],
      type: ["VerifiableCredential"],
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
        metaPointer: undefined,
        hash: "v0.0.0:HLEH/2c+EIFqSwYbiYiCK1dGVH17mVbA23Ez5c7kr/Q=",
      },
    };

    const options = {
      type: "EthereumEip712Signature2021",
      verificationMethod:
        "did:ethr:0xd6fc34345bc8c8e5659a35bed9629d5558d48c4e#Eip712Method2021",
      eip712Domain: {
        domain: {
          name: "GitcoinPassportStampVerifiableCredential",
          version: "0",
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
              type: "Context",
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
        },
        primaryType: "Document",
      },
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

    const preppedCredential = JSON.parse(preparedCredential);
    const signedCredential = JSON.parse(issuedCredential);

    const standardizedTypes = preppedCredential.signingInput.types;
    delete standardizedTypes.EIP712Domain;

    debugger;
    const signerAddress = ethers.verifyTypedData(
      preppedCredential.proof.eip712Domain.domain,
      standardizedTypes,
      signedCredential,
      signedCredential.proof.proofValue
    );

    // last run signerAddress 0x6a24210b3403B66f1D3A78f4563FdECC7616e151
    const signedCredIssuer = signedCredential.issuer.split(":").pop();
    const signerIssuedCredential =
      signerAddress.toLowerCase() === signedCredIssuer;

    const signature = Signature.from(sampleCredential.proof.proofValue);
    const { r, s, v } = signature;
    debugger;

    console.log({ issuedCredential, preparedCredential });
  });
});
