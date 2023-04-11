import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Signer } from "ethers";

const googleStamp = {
  provider: "Google",
  stampHash: "234567890",
  expirationDate: "2023-12-31",
}

const facebookStamp = {
  provider: "Facebook",
  stampHash: "234567891",
  expirationDate: "2023-12-31",
}

const twitterStamp = {
  provider: "Twitter",
  stampHash: "234567892",
  expirationDate: "2023-12-31",
}

let contractOwner: Signer, iamSigner: Signer;

describe("Verifier", function () {
  this.beforeAll(async function () {
    const [owner, otherAccount] = await ethers.getSigners();

    this.signer = ethers.Wallet.createRandom();

    this.contractOwner = owner
    this.iamSigner = otherAccount

    const verifierFactory = await ethers.getContractFactory("Verifier");
    console.log(this.signer.address, "issuer")
    this.verifier = await verifierFactory.deploy(this.signer.address);
  });
  it("should verify a valid EIP712 signature", async function () {
    // TODO: add back into domain
    // version: "1",
    // chainId: "1",
    // verifyingContract: gitcoinAttester.address,
    const domain = {
      name: "Attester",
    };

    const signatureTypes = {
      Stamp: [
        { name: "provider", type: "string" },
        { name: "stampHash", type: "string" },
        { name: "expirationDate", type: "string" }
      ],
      Passport: [
        { name: "stamps", type: "Stamp[]" }
      ]
    }

    const passport = {
      stamps: [
        googleStamp,
        facebookStamp,
        twitterStamp
      ]
    }

    const signature = await this.signer._signTypedData(domain, signatureTypes, passport);
    const { v, r, s } = ethers.utils.splitSignature(signature);

    const result = await this.verifier.verify(
      v,
      r,
      s,
      passport,
    );
    expect(result).to.equal(true);
  });
});