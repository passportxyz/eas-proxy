import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Signer } from "ethers";
import {
	NO_EXPIRATION,
	SchemaEncoder,
	ZERO_BYTES32,
} from "@ethereum-attestation-service/eas-sdk";
import { easEncodeData } from "./GitcoinAttester";

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
};

describe("Verifier", function () {
	this.beforeAll(async function () {
		const [owner, otherAccount] = await ethers.getSigners();

		const verifierFactory = await ethers.getContractFactory("Verifier");
		iamAccount = owner;
		this.verifier = await verifierFactory.deploy(iamAccount.address);
		this.otherAccount = otherAccount;
		const chainId = await iamAccount.getChainId();
		console.log({ chainId });
		this.domain = {
			name: "Attester",
			version: "1",
			chainId,
			verifyingContract: this.verifier.address,
		};

		this.types = {
			Stamp: [
				{ name: "provider", type: "string" },
				{ name: "stampHash", type: "string" },
				{ name: "expirationDate", type: "string" },
				{ name: "encodedData", type: "bytes" },
			],
			Passport: [
				{ name: "stamps", type: "Stamp[]" },
				{ name: "recipient", type: "address" },
				{ name: "expirationTime", type: "uint64" },
				{ name: "revocable", type: "bool" },
				{ name: "refUID", type: "bytes32" },
				{ name: "value", type: "uint256" },
				{ name: "nonce", type: "uint256" },
			],
		};

		this.passport = {
			stamps: [
				{
					provider: googleStamp.provider,
					stampHash: googleStamp.stampHash,
					expirationDate: googleStamp.expirationDate,
					encodedData: easEncodeData(googleStamp),
				},
				{
					provider: facebookStamp.provider,
					stampHash: facebookStamp.stampHash,
					expirationDate: facebookStamp.expirationDate,
					encodedData: easEncodeData(googleStamp),
				},
			],
			recipient: this.otherAccount.address,
			expirationTime: NO_EXPIRATION,
			revocable: true,
			refUID: ZERO_BYTES32,
			value: 0,
		};
	});
	this.beforeEach(async function () {
		this.passport.nonce = await this.verifier.recipientNonces(this.passport.recipient);
	});

	it("should verify a valid EIP712 signature", async function () {
		const signature = await iamAccount._signTypedData(
			this.domain,
			this.types,
			this.passport
		);
		const recoveredAddress = ethers.utils.verifyTypedData(
			this.domain,
			this.types,
			this.passport,
			signature
		);

		expect(recoveredAddress).to.equal(iamAccount.address);

		const { v, r, s } = ethers.utils.splitSignature(signature);

		const verifiedSignature = await this.verifier.callStatic.verify(
			v,
			r,
			s,
			this.passport
		);
		console.log("verified Signature", verifiedSignature);

		expect(verifiedSignature).to.equal(true);
	});

	it("should revert if the signature is invalid", async function () {
		const signature = await iamAccount._signTypedData(
			this.domain,
			this.types,
			this.passport
		);
		const recoveredAddress = ethers.utils.verifyTypedData(
			this.domain,
			this.types,
			this.passport,
			signature
		);

		expect(recoveredAddress).to.equal(iamAccount.address);

		const { v, r, s } = ethers.utils.splitSignature(signature);

		const badV = 30;

		try {
			const verifiedSignature = await this.verifier.verify(badV, r, s, this.passport);
		} catch (e: any) {
			expect(e.message).to.include("ECDSA: invalid signature");
			return;
		}
	});

	it("should be false if verify is called twice with the same parameters", async function () {
		const signature = await iamAccount._signTypedData(
			this.domain,
			this.types,
			this.passport
		);

		const { v, r, s } = ethers.utils.splitSignature(signature);

		//running verify function once
		const verifyCall1 = await (await this.verifier.verify(v, r, s, this.passport)).wait();
		console.log("verifyCall1", verifyCall1);

		//running verify function again!
		const verifyCall2 = await this.verifier.callStatic.verify(v, r, s, this.passport);
		console.log("verifyCall2", verifyCall2);

		//If replay protection works verifyCall2 shouldn't work!
		expect(verifyCall2).to.equal(false);
	});
});
