import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Signer } from "ethers";

const googleStamp = {
  provider: "Google",
  stampHash: "234567890",
  expirationDate: "2023-12-31",
};

let iamAccount: SignerWithAddress, iamSigner: Signer;

describe("Verifier", function () {
  this.beforeAll(async function () {
    const [owner, otherAccount] = await ethers.getSigners();

    const verifierFactory = await ethers.getContractFactory("Verifier");
    iamAccount = owner;
    console.log(iamAccount.address, "iamAccount.address");
    this.verifier = await verifierFactory.deploy(iamAccount.address);
  });
  it("should verify a valid EIP712 signature", async function () {
    const domain = {
      name: "Attester",
      version: "1",
      chainId: 1,
      verifyingContract: this.verifier.address,
    };

    const types = {
      Stamp: [
        { name: "provider", type: "string" },
        { name: "stampHash", type: "string" },
        { name: "expirationDate", type: "string" },
      ],
    };

    const message = {
      provider: googleStamp.provider,
      stampHash: googleStamp.stampHash,
      expirationDate: googleStamp.expirationDate,
    };

    const signature = await iamAccount._signTypedData(domain, types, message);
    const recoveredAddress = ethers.utils.verifyTypedData(
      domain,
      types,
      message,
      signature
    );
    console.log(recoveredAddress, "recoveredAddress", iamAccount.address, "iamAccount.address")
    expect(recoveredAddress).to.equal(iamAccount.address);

    const { v, r, s } = ethers.utils.splitSignature(signature);

    const verifiedStamp = await this.verifier.verify(v, r, s, googleStamp);

    expect(verifiedStamp).to.equal(true);
  });
});
