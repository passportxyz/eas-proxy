import { expect } from "chai";
import { ethers } from "hardhat";

import { EAS, ZERO_BYTES32 } from "@ethereum-attestation-service/eas-sdk";
import { easEncodeScore, easEncodeStamp } from "./helpers/mockAttestations";

import {
  googleStamp,
  facebookStamp,
  passportTypes,
  scorer1Score,
  scorer2Score,
  EAS_CONTRACT_ADDRESS,
  fee1,
} from "./helpers/verifierTests";

import { schemaRegistryContractAddress } from "./GitcoinResolver";
import { SCHEMA_REGISTRY_ABI } from "./abi/SCHEMA_REGISTRY_ABI";

describe("GitcoinEASProxy", function () {
  this.beforeAll(async function () {
    const [ownerAccount, otherAccount, recipientAccount] =
      await ethers.getSigners();

    this.owner = ownerAccount;
    this.iamAccount = otherAccount;
    this.recipient = recipientAccount;

    // Deploy GitcoinAttester
    const GitcoinAttester = await ethers.getContractFactory(
      "GitcoinAttester",
      this.owner
    );
    this.gitcoinAttester = await GitcoinAttester.deploy();
    await this.gitcoinAttester.connect(this.owner).initialize();
    this.gitcoinAttesterAddress = await this.gitcoinAttester.getAddress();

    // Deploy GitcoinVerifier
    const GitcoinVerifier = await ethers.getContractFactory(
      "GitcoinVerifier",
      this.owner
    );
    this.gitcoinVerifier = await GitcoinVerifier.deploy();

    await this.gitcoinVerifier
      .connect(this.owner)
      .initialize(
        await this.iamAccount.getAddress(),
        await this.gitcoinAttester.getAddress()
      );

    this.eas = new EAS(EAS_CONTRACT_ADDRESS);
    await this.gitcoinAttester.setEASAddress(EAS_CONTRACT_ADDRESS);

    const chainId = await ethers.provider
      .getNetwork()
      .then((n: { chainId: any }) => n.chainId);

    this.domain = {
      name: "GitcoinVerifier",
      version: "1",
      chainId,
      verifyingContract: await this.gitcoinVerifier.getAddress(),
    };

    this.getNonce = async (address: string) => {
      return await this.gitcoinVerifier.recipientNonces(address);
    };

    this.uid = ethers.keccak256(ethers.toUtf8Bytes("test"));

    // Deploy GitcoinResolver
    const GitcoinResolver = await ethers.getContractFactory(
      "GitcoinResolver",
      this.owner
    );
    this.gitcoinResolver = await GitcoinResolver.deploy();
    await this.gitcoinResolver
      .connect(this.owner)
      .initialize(
        EAS_CONTRACT_ADDRESS,
        await this.gitcoinAttester.getAddress()
      );

    // Register schema for resolver
    const schemaRegistry = new ethers.Contract(
      ethers.getAddress(schemaRegistryContractAddress),
      SCHEMA_REGISTRY_ABI,
      this.owner
    );

    this.scoreSchemaInput = "uint32 score,uint32 scorer_id";
    this.stampSchemaInput = "string provider,string hash";
    this.resolverAddress = await this.gitcoinResolver.getAddress();
    this.revocable = true;

    this.stampTx = await schemaRegistry.register(
      this.stampSchemaInput,
      this.resolverAddress,
      this.revocable
    );

    this.scoreTx = await schemaRegistry.register(
      this.scoreSchemaInput,
      this.resolverAddress,
      this.revocable
    );

    this.scoreSchemaTxReceipt = await this.scoreTx.wait();
    const scoreSchemaEvent = this.scoreSchemaTxReceipt.logs.filter(
      (log: any) => {
        return log.fragment.name == "Registered";
      }
    );
    this.scoreSchemaUID = scoreSchemaEvent[0].args[0];

    this.passportSchemaTxReceipt = await this.stampTx.wait();
    const passportSchemaEvent = this.passportSchemaTxReceipt.logs.filter(
      (log: any) => {
        return log.fragment.name == "Registered";
      }
    );
    this.passportSchemaUID = passportSchemaEvent[0].args[0];

    this.passport = {
      multiAttestationRequest: [
        {
          schema: this.passportSchemaUID,
          data: [
            {
              recipient: this.recipient.address,
              expirationTime: 1708741995,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeStamp(googleStamp),
              value: 0,
            },
            {
              recipient: this.recipient.address,
              expirationTime: 1708741995,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeStamp(facebookStamp),
              value: 0,
            },
          ],
        },
        {
          schema: this.scoreSchemaUID,
          data: [
            {
              recipient: this.recipient.address,
              expirationTime: 1708741995,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer1Score),
              value: 0,
            },
            {
              recipient: this.recipient.address,
              expirationTime: 1708741995,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer2Score),
              value: 0,
            },
            {
              recipient: this.recipient.address,
              expirationTime: 1708741995,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(scorer2Score),
              value: 0,
            },
          ],
        },
      ],
      nonce: await this.getNonce(this.recipient.address),
      fee: fee1,
    };

    const addVerifierResult = await this.gitcoinAttester
      .connect(this.owner)
      .addVerifier(await this.gitcoinVerifier.getAddress());

    await addVerifierResult.wait();

    await expect(addVerifierResult)
      .to.emit(this.gitcoinAttester, "VerifierAdded")
      .withArgs(await this.gitcoinVerifier.getAddress());
  });

  this.beforeEach(async function () {
    this.passport.nonce = await this.gitcoinVerifier.recipientNonces(
      this.passport.multiAttestationRequest[0].data[0].recipient
    );
  });

  describe("GitcoinEASProxy", function () {
    it("should move through the entire Gitcoin EAS proxy attestation flow", async function () {
      const signature = await this.iamAccount.signTypedData(
        this.domain,
        passportTypes,
        this.passport
      );

      const { v, r, s } = ethers.Signature.from(signature);

      expect(
        await this.gitcoinResolver.userAttestations(
          this.recipient.address,
          this.passportSchemaUID
        )
      ).to.equal(ZERO_BYTES32);

      // Submit attestations
      const verifiedPassport = await this.gitcoinVerifier.verifyAndAttest(
        this.passport,
        v,
        r,
        s,
        {
          value: fee1,
        }
      );

      await verifiedPassport.wait();

      const receipt = await verifiedPassport.wait();
      expect(receipt.status).to.equal(1);

      expect(
        await this.gitcoinResolver.userAttestations(
          this.recipient.address,
          this.passportSchemaUID
        )
      ).not.to.equal(ZERO_BYTES32);
    });

    it("should move through the entire Gitcoin EAS proxy revocation flow", async function () {
      const signature = await this.iamAccount.signTypedData(
        this.domain,
        passportTypes,
        this.passport
      );

      const { v, r, s } = ethers.Signature.from(signature);

      const attested = await this.gitcoinVerifier.verifyAndAttest(
        this.passport,
        v,
        r,
        s,
        {
          value: fee1,
        }
      );

      await attested.wait();

      const passportAttestationUID =
        await this.gitcoinResolver.userAttestations(
          this.recipient.address,
          this.passportSchemaUID
        );
      const scoreAttestationUID = await this.gitcoinResolver.userAttestations(
        this.recipient.address,
        this.scoreSchemaUID
      );

      const multiRevocationRequest = [
        {
          schema: this.passportSchemaUID,
          data: [
            {
              uid: passportAttestationUID,
              value: 0,
            },
          ],
        },
        {
          schema: this.scoreSchemaUID,
          data: [
            {
              uid: scoreAttestationUID,
              value: 0,
            },
          ],
        },
      ];

      await this.gitcoinAttester
        .connect(this.owner)
        .revokeAttestations(multiRevocationRequest);

      const passportUID = await this.gitcoinResolver.userAttestations(
        this.recipient.address,
        this.passportSchemaUID
      );
      expect(passportUID).to.equal(ZERO_BYTES32);

      const scoreUID = await this.gitcoinResolver.userAttestations(
        this.recipient.address,
        this.scoreSchemaUID
      );
      expect(scoreUID).to.equal(ZERO_BYTES32);
    });
  });
});
