import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Signer } from "ethers";
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

const googleStamp = {
  provider: "Google",
  stampHash: "234567890",
  expirationDate: "2023-12-31",
};

const facebookStamp = {
  provider: "Facebook",
  stampHash: "234567891",
  expirationDate: "2023-12-31",
};

let iamAccount: SignerWithAddress, iamSigner: Signer;

type Stamp = {
  provider: string;
  stampHash: string;
  expirationDate: string;
}

export function encodeStampDataEAS(stamp: Stamp): string {
  const schemaEncoder = new SchemaEncoder("string provider, string hash");
  return schemaEncoder.encodeData([
    { name: "provider", value: stamp.provider, type: "string" },
    { name: "hash", value: stamp.stampHash, type: "string" },
  ]);
}

describe("Verifier", function () {
  this.beforeAll(async function () {
    const [owner, otherAccount] = await ethers.getSigners();

    const verifierFactory = await ethers.getContractFactory("Verifier");
    iamAccount = owner;
    console.log(iamAccount.address, "iamAccount.address");
    this.verifier = await verifierFactory.deploy(iamAccount.address);
    this.otherAccount = otherAccount;
  });
  it("should verify a valid EIP712 signature", async function () {
    const chainId = await iamAccount.getChainId();
    console.log({ chainId })
    const domain = {
      name: "Attester",
      version: "1",
      chainId,
      verifyingContract: this.verifier.address,
    };

    const types = {
      Stamp: [
        { name: "provider", type: "string" },
        { name: "stampHash", type: "string" },
        { name: "expirationDate", type: "string" },
        { name: "encodedData", type: "string" }
      ],
      Passport: [
        { name: "stamps", type: "Stamp[]" },
        { name: "recipient", type: "address" }
      ]
    };

    const passport = {
      stamps: [
        {
          provider: googleStamp.provider,
          stampHash: googleStamp.stampHash,
          expirationDate: googleStamp.expirationDate,
          encodedData: encodeStampDataEAS(googleStamp)
        },
        {
          provider: facebookStamp.provider,
          stampHash: facebookStamp.stampHash,
          expirationDate: facebookStamp.expirationDate,
          encodedData: encodeStampDataEAS(facebookStamp)
        }
      ],
      recipient: this.otherAccount.address
    };

    const signature = await iamAccount._signTypedData(domain, types, passport);
    const recoveredAddress = ethers.utils.verifyTypedData(
      domain,
      types,
      passport,
      signature
    );

    expect(recoveredAddress).to.equal(iamAccount.address);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    const verifiedStamp = await this.verifier.verify(v, r, s, passport);

    expect(verifiedStamp).to.equal(true);
  });
});
