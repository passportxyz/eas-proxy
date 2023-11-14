import { expect } from "chai";
import { ethers } from "hardhat";
import {
  SchemaEncoder,
  ZERO_ADDRESS,
  ZERO_BYTES32,
} from "@ethereum-attestation-service/eas-sdk";
import { SCHEMA_REGISTRY_ABI } from "./abi/SCHEMA_REGISTRY_ABI";
import { schemaRegistryContractAddress } from "./GitcoinResolver";
import {
  passportTypes,
  fee1,
  EAS_CONTRACT_ADDRESS,
} from "./helpers/verifierTests";
import providerBitmap from "../deployments/providerBitMapInfo.json";

const issuanceDates = [1694628559, 1695047108, 1693498086];
const expirationDates = [1702404559, 1702823108, 1701274086];
const hashes = [
  ethers.getBytes(
    "0xf760285ed09eb7bb0da39df5abd0adb608d410b357ab6415644d2b49aa64e5f1"
  ),
  ethers.getBytes(
    "0x29b3eb7b8ee47cb0a9d83e7888f05ea5f61e3437752602282e18129d2d8b4024"
  ),
  ethers.getBytes(
    "0x84c6f60094c95180e54fac3e9a5cfde8ca430e598e987504474151a219ae0d13"
  ),
];
const providerMapVersion = 0;

const invalidIssuanceDates = [1694628559, 1695047108, 1693498086, 1695047109];
const invalidExpirationDates = [1702404559, 1702823108];
const invalidHashes = [
  ethers.getBytes(
    "0xf760285ed09eb7bb0da39df5abd0adb608d410b357ab6415644d2b49aa64e5f1"
  ),
  ethers.getBytes(
    "0x29b3eb7b8ee47cb0a9d83e7888f05ea5f61e3437752602282e18129d2d8b4024"
  ),
  ethers.getBytes(
    "0x84c6f60094c95180e54fac3e9a5cfde8ca430e598e987504474151a219ae0d13"
  ),
  ethers.getBytes(
    "0x84c6f60094c95180e54fac3e9a5cfde8ca430e598e987504474151a219ab1d24"
  ),
  ethers.getBytes(
    "0x84c6f60094c95180e54fac3e9a5cfde8ca430e598e987504474151a219af2d35"
  ),
];

const easEncodePassport = (providers: bigint[]) => {
  const schemaEncoder = new SchemaEncoder(
    "uint256[] providers, bytes32[] hashes, uint64[] issuanceDates, uint64[] expirationDates, uint16 providerMapVersion"
  );

  const encodedData = schemaEncoder.encodeData([
    { name: "providers", value: providers, type: "uint256[]" },
    { name: "hashes", value: hashes, type: "bytes32[]" },
    { name: "issuanceDates", value: issuanceDates, type: "uint64[]" },
    { name: "expirationDates", value: expirationDates, type: "uint64[]" },
    { name: "providerMapVersion", value: providerMapVersion, type: "uint16" },
  ]);
  return encodedData;
};

const scoreEasSchema = "uint256 score,uint32 scorer_id,uint8 score_decimals";

const easEncodeScore = () => {
  const schemaEncoder = new SchemaEncoder(scoreEasSchema);

  const encodedData = schemaEncoder.encodeData([
    { name: "score", value: 100, type: "uint256" },
    { name: "scorer_id", value: 1, type: "uint32" },
    { name: "score_decimals", value: 18, type: "uint8" },
  ]);
  return encodedData;
};

const easEncodeInvalidStamp = () => {
  const schemaEncoder = new SchemaEncoder(
    "uint256[] providers, bytes32[] hashes, uint64[] issuanceDates, uint64[] expirationDates, uint16 providerMapVersion"
  );

  const encodedData = schemaEncoder.encodeData([
    { name: "providers", value: [BigInt("111")], type: "uint256[]" },
    { name: "hashes", value: invalidHashes, type: "bytes32[]" },
    { name: "issuanceDates", value: invalidIssuanceDates, type: "uint64[]" },
    {
      name: "expirationDates",
      value: invalidExpirationDates,
      type: "uint64[]",
    },
    { name: "providerMapVersion", value: providerMapVersion, type: "uint16" },
  ]);
  return encodedData;
};

describe("GitcoinPassportDecoder", function () {
  this.beforeEach(async function () {
    // this.beforeAll(async function () {
    const [ownerAccount, iamAcct, recipientAccount, otherAccount, gasAccount] =
      await ethers.getSigners();

    this.owner = ownerAccount;
    this.iamAccount = iamAcct;
    this.recipient = recipientAccount;
    this.otherAcct = otherAccount;
    this.gasAccount = gasAccount;

    // Deploy GitcoinAttester
    const GitcoinAttester = await ethers.getContractFactory(
      "GitcoinAttester",
      this.owner
    );
    this.gitcoinAttester = await GitcoinAttester.deploy();
    await this.gitcoinAttester.connect(this.owner).initialize();

    // Deploy GitcoinVerifier
    const GitcoinVerifier = await ethers.getContractFactory(
      "GitcoinVerifier",
      this.owner
    );
    this.gitcoinVerifier = await GitcoinVerifier.deploy();

    this.gitcoinAttesterAddress = await this.gitcoinAttester.getAddress();
    await this.gitcoinAttester.setEASAddress(EAS_CONTRACT_ADDRESS);

    await this.gitcoinVerifier
      .connect(this.owner)
      .initialize(
        await this.iamAccount.getAddress(),
        await this.gitcoinAttester.getAddress()
      );

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

    this.stampSchemaInput =
      "uint256[] providers, bytes32[] hashes, uint64[] issuanceDates, uint64[] expirationDates, uint16 providerMapVersion";
    this.resolverAddress = await this.gitcoinResolver.getAddress();
    this.revocable = true;

    this.stampTx = await schemaRegistry.register(
      this.stampSchemaInput,
      this.resolverAddress,
      this.revocable
    );

    this.passportSchemaTxReceipt = await this.stampTx.wait();
    const passportSchemaEvent = this.passportSchemaTxReceipt.logs.filter(
      (log: any) => {
        return log.fragment.name == "Registered";
      }
    );
    this.passportSchemaUID = passportSchemaEvent[0].args[0];

    this.scoreSchemaInput = scoreEasSchema;
    this.scoreSchemaTx = await schemaRegistry.register(
      this.scoreSchemaInput,
      this.resolverAddress,
      this.revocable
    );

    const scoreSchemaEvent = this.passportSchemaTxReceipt.logs.filter(
      (log: any) => {
        return log.fragment.name == "Registered";
      }
    );
    this.scoreSchemaUID = scoreSchemaEvent[0].args[0];

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
              data: easEncodePassport([BigInt("111")]),
              value: 0,
            },
          ],
        },
      ],
      nonce: await this.getNonce(this.recipient.address),
      fee: fee1,
    };

    this.score = {
      multiAttestationRequest: [
        {
          schema: this.scoreSchemaUID,
          data: [
            {
              recipient: this.recipient.address,
              expirationTime: 1708741995,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeScore(),
              value: 0,
            },
          ],
        },
      ],
      nonce: await this.getNonce(this.recipient.address),
      fee: fee1,
    };

    this.invalidPassport = {
      multiAttestationRequest: [
        {
          schema: this.passportSchemaUID,
          data: [
            {
              recipient: this.recipient.address,
              expirationTime: 1708741995,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeInvalidStamp(),
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

    const GitcoinPassportDecoder = await ethers.getContractFactory(
      "GitcoinPassportDecoder",
      this.owner
    );

    this.gitcoinPassportDecoder = await GitcoinPassportDecoder.deploy();

    await this.gitcoinPassportDecoder.connect(this.owner).initialize();

    // Initialize the sdk with the address of the EAS Schema contract address
    await this.gitcoinPassportDecoder.setEASAddress(EAS_CONTRACT_ADDRESS);
    await this.gitcoinPassportDecoder.setGitcoinResolver(this.resolverAddress);
    await this.gitcoinPassportDecoder.setPassportSchemaUID(
      this.passportSchemaUID
    );

    await this.gitcoinPassportDecoder.setScoreSchemaUID(this.scoreSchemaUID);

    this.passport.nonce = await this.gitcoinVerifier.recipientNonces(
      this.passport.multiAttestationRequest[0].data[0].recipient
    );
  });

  describe("Adding new providers to current version of providers", async function () {
    it("should append a provider to the end of an existing provider mapping", async function () {
      const providers = ["NewStamp1", "NewStamp2"];

      await this.gitcoinPassportDecoder
        .connect(this.owner)
        .addProviders(providers);

      await this.gitcoinPassportDecoder
        .connect(this.owner)
        .addProviders(["NewStamp3"]);

      const currentVersion = await this.gitcoinPassportDecoder.currentVersion();

      const lastProvider = await this.gitcoinPassportDecoder.providerVersions(
        currentVersion,
        2
      );

      expect(lastProvider === "NewStamp3");
    });

    it("should return provider given a version", async function () {
      const providers = ["NewStamp1", "NewStamp2"];
      await this.gitcoinPassportDecoder
        .connect(this.owner)
        .addProviders(providers);

      const currentVersion = await this.gitcoinPassportDecoder.currentVersion();

      const savedProviders = await this.gitcoinPassportDecoder.getProviders(
        currentVersion
      );

      expect(savedProviders.length === providers.length);
      expect(savedProviders).to.eql(providers);
    });

    it("should not allow anyone other than owner to append new providers array in the provider mapping", async function () {
      await expect(
        this.gitcoinPassportDecoder
          .connect(this.recipient)
          .addProviders(["NewStamp3"])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should throw an error when trying to add the same provider twice in different function calls", async function () {
      const providersForCall1 = ["NewStamp1", "NewStamp2"];
      const providersForCall2 = ["NewStamp3", "NewStamp2"];

      await this.gitcoinPassportDecoder
        .connect(this.owner)
        .addProviders(providersForCall1);

      await expect(
        this.gitcoinPassportDecoder
          .connect(this.owner)
          .addProviders(providersForCall2)
      ).to.be.revertedWithCustomError(
        this.gitcoinPassportDecoder,
        "ProviderAlreadyExists"
      );
    });

    it("should throw an error when trying to add the same provider twice in the same function call", async function () {
      const providersForCall1 = [
        "NewStamp1",
        "NewStamp2",
        "NewStamp3",
        "NewStamp2",
      ];

      await expect(
        this.gitcoinPassportDecoder
          .connect(this.owner)
          .addProviders(providersForCall1)
      ).to.be.revertedWithCustomError(
        this.gitcoinPassportDecoder,
        "ProviderAlreadyExists"
      );
    });

    it("should throw an error when trying to add a provider with a zero value", async function () {
      const providersForCall1 = [""];
      await expect(
        this.gitcoinPassportDecoder
          .connect(this.owner)
          .addProviders(providersForCall1)
      ).to.be.revertedWithCustomError(
        this.gitcoinPassportDecoder,
        "EmptyProvider"
      );
    });

    it("should allow adding providers with the same name but different version", async function () {
      await this.gitcoinPassportDecoder
        .connect(this.owner)
        .addProviders(["NewStamp1", "NewStamp2"]);

      const currentVersion = await this.gitcoinPassportDecoder.currentVersion();

      const lastProvider = await this.gitcoinPassportDecoder.providerVersions(
        currentVersion,
        1
      );

      expect(lastProvider === "NewStamp2");

      await this.gitcoinPassportDecoder
        .connect(this.owner)
        .createNewVersion(["NewStamp1"]);

      await this.gitcoinPassportDecoder
        .connect(this.owner)
        .addProviders(["NewStamp2"]);

      const updatedVersion = await this.gitcoinPassportDecoder.currentVersion();

      const updatedLastProvider =
        await this.gitcoinPassportDecoder.providerVersions(updatedVersion, 1);

      expect(updatedLastProvider === "NewStamp2");
    });
  });

  describe("Decoding Passports", async function () {
    // providers that were created in previous tests
    const providers = ["NewStamp1", "NewStamp2", "NewStamp3"];
    it("should decode a user's passport", async function () {
      const signature = await this.iamAccount.signTypedData(
        this.domain,
        passportTypes,
        this.passport
      );

      const { v, r, s } = ethers.Signature.from(signature);

      await this.gitcoinPassportDecoder
        .connect(this.owner)
        .addProviders(providers);

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

      const passportTx = await this.gitcoinPassportDecoder
        .connect(this.owner)
        .getPassport(this.recipient.address);

      expect(passportTx.length === providers.length);

      passportTx.forEach((cred: any, i: number) => {
        expect(cred[0]).to.equal(providers[i]);
        expect(ethers.getBytes(cred[1])).to.eql(hashes[i]);
        expect(cred[2]).to.equal(issuanceDates[i]);
        expect(cred[3]).to.equal(expirationDates[i]);
      });
    });

    it("should allow non-owners to decode a user's passport", async function () {
      const signature = await this.iamAccount.signTypedData(
        this.domain,
        passportTypes,
        this.passport
      );

      const { v, r, s } = ethers.Signature.from(signature);

      await this.gitcoinPassportDecoder
        .connect(this.owner)
        .addProviders(providers);

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

      const passportTx = await this.gitcoinPassportDecoder
        .connect(this.otherAcct)
        .getPassport(this.recipient.address);

      expect(passportTx.length === providers.length);

      passportTx.forEach((cred: any) => {
        providers.forEach((provider: string) => {
          expect(cred[0] === provider);
        });
        hashes.forEach((hash: Uint8Array) => {
          expect(cred[1] === hash);
        });
        issuanceDates.forEach((issuanceDate: number) => {
          expect(cred[2] === issuanceDate);
        });
        expirationDates.forEach((expirationDate: number) => {
          expect(cred[3] === expirationDate);
        });
      });
    });

    it("should verify assertions in contract are working via invalid data", async function () {
      this.invalidPassport.nonce = await this.gitcoinVerifier.recipientNonces(
        this.invalidPassport.multiAttestationRequest[0].data[0].recipient
      );

      const signature = await this.iamAccount.signTypedData(
        this.domain,
        passportTypes,
        this.invalidPassport
      );

      const { v, r, s } = ethers.Signature.from(signature);

      // Submit attestations
      const verifiedPassport = await this.gitcoinVerifier.verifyAndAttest(
        this.invalidPassport,
        v,
        r,
        s,
        {
          value: fee1,
        }
      );

      await verifiedPassport.wait();

      expect(
        this.gitcoinPassportDecoder
          .connect(this.owner)
          .getPassport(this.recipient.address)
      ).to.be.revertedWithPanic();
    });
  });
  describe("Creating new versions", function () {
    it("should add new providers to the providers mapping and increment the version", async function () {
      const providers = ["NewStamp1", "NewStamp2"];
      // Get the 0th version
      const versionZero = await this.gitcoinPassportDecoder.currentVersion();

      expect(versionZero === 0);

      await this.gitcoinPassportDecoder
        .connect(this.owner)
        .createNewVersion(providers);

      // Get the current version
      const currentVersion = await this.gitcoinPassportDecoder.currentVersion();

      expect(currentVersion === 1);

      const firstProvider = await this.gitcoinPassportDecoder.providerVersions(
        currentVersion,
        0
      );

      expect(firstProvider === providers[0]);
    });

    it("should not allow anyone other than owner to add new providers to the mapping", async function () {
      const providers = ["NewStamp1", "NewStamp2"];
      // Get the 0th version
      const versionZero = await this.gitcoinPassportDecoder.currentVersion();

      expect(versionZero === 0);

      await expect(
        this.gitcoinPassportDecoder
          .connect(this.recipient)
          .addProviders(providers)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
  describe("Contract configuration", function () {
    const mockAddress = "0x8869E49DE43ca33026D9feB8580977333F07A228";
    const mockBytes32 =
      "0xadc444fd654fe0a6aedaa8fadd67d791941738b645c9955f4a1dd66a7af1aae1";
    async function testSetAddress(
      functionName: string,
      addressConstant: string,
      error: string,
      addressParam: boolean
    ) {
      let mockValue = mockAddress;
      if (!addressParam) {
        mockValue = mockBytes32;
      }
      it(`should set the ${addressConstant}`, async function () {
        await this.gitcoinPassportDecoder
          .connect(this.owner)
          [functionName](mockValue);
      });

      it(`should not allow anyone other than owner to set the ${addressConstant}`, async function () {
        await expect(
          this.gitcoinPassportDecoder
            .connect(this.recipient)
            [functionName](mockValue)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it(`should not allow ${addressConstant} to be set to zero address`, async function () {
        await expect(
          this.gitcoinPassportDecoder
            .connect(this.owner)
            [functionName](addressParam ? ZERO_ADDRESS : ZERO_BYTES32)
        ).to.be.revertedWithCustomError(this.gitcoinPassportDecoder, error);
      });
    }

    describe("getting and setting EAS address", function () {
      testSetAddress("setEASAddress", "EAS", "ZeroValue", true);
    });

    describe("setting resolver address", function () {
      testSetAddress("setGitcoinResolver", "Resolver", "ZeroValue", true);
    });

    describe("setting passport schema", function () {
      testSetAddress(
        "setPassportSchemaUID",
        "Passport SchemaUID",
        "ZeroValue",
        false
      );
    });

    describe("setting score schema", function () {
      testSetAddress(
        "setScoreSchemaUID",
        "Score SchemaUID",
        "ZeroValue",
        false
      );
    });
  });
  describe("Getting score", function () {
    beforeEach(async function () {
      const attestation = {
        multiAttestationRequest: [
          {
            schema: this.passportSchemaUID,
            data: [
              {
                recipient: this.recipient.address,
                expirationTime: 1708741995,
                revocable: true,
                refUID: ZERO_BYTES32,
                data: easEncodeScore(),
                value: 0,
              },
            ],
          },
        ],
        nonce: await this.getNonce(this.recipient.address),
        fee: fee1,
      };

      const signature = await this.iamAccount.signTypedData(
        this.domain,
        passportTypes,
        attestation
      );

      const { v, r, s } = ethers.Signature.from(signature);

      // Submit attestations
      const verifiedPassport = await this.gitcoinVerifier.verifyAndAttest(
        attestation,
        v,
        r,
        s,
        {
          value: fee1,
        }
      );
    });
    it("should get a user's score", async function () {
      const score = await this.gitcoinPassportDecoder.getScore(
        this.recipient.address
      );
      expect(score[0]).to.equal(100n);
      expect(score[1]).to.equal(1n);
      expect(score[2]).to.equal(18n);
    });
    it("should revert if address has no attested score", async function () {
      await expect(
        this.gitcoinPassportDecoder.getScore(this.owner.address)
      ).to.be.revertedWithCustomError(
        this.gitcoinPassportDecoder,
        "AttestationNotFound"
      );
    });
    it("should revert if attestation is revoked", async function () {
      const scoreAttestation = await this.gitcoinResolver.getUserAttestation(
        this.recipient.address,
        this.scoreSchemaUID
      );
      await this.gitcoinAttester.revokeAttestations([
        {
          schema: this.scoreSchemaUID,
          data: [
            {
              uid: scoreAttestation,
              value: 0n,
            },
          ],
        },
      ]);

      await expect(
        this.gitcoinPassportDecoder.getScore(this.recipient.address)
      ).to.be.revertedWithCustomError(
        this.gitcoinPassportDecoder,
        "AttestationNotFound"
      );
    });
  });
  describe.only("Gas costs of getting passport", function () {
    beforeEach(async function () {
      const decoderAddress = await this.gitcoinPassportDecoder.getAddress();

      const GitcoinPassportDecoderGasUsage = await ethers.getContractFactory(
        "GitcoinPassportDecoderGasUsage",
        this.owner
      );

      this.gitcoinPassportDecoderGasUsage =
        await GitcoinPassportDecoderGasUsage.deploy(decoderAddress);

      const allProviders = providerBitmap.map((bit) => bit.name);
      const hashesOverride: string[] = [];
      const issuanceDatesOverride: number[] = [];
      const expirationDatesOverride: number[] = [];

      const filledProviders = "111111111111111111111111111111111111111111111";

      allProviders.forEach((_provider, i) => {
        if (i < filledProviders.length) {
          hashesOverride.push(ZERO_BYTES32);
          issuanceDatesOverride.push(1694628559);
          expirationDatesOverride.push(1702404559);
        }
      });

      await this.gitcoinPassportDecoder
        .connect(this.owner)
        .addProviders(allProviders);

      const schemaEncoder = new SchemaEncoder(
        "uint256[] providers, bytes32[] hashes, uint64[] issuanceDates, uint64[] expirationDates, uint16 providerMapVersion"
      );

      const fullBitMap = [BigInt(filledProviders)];

      const encodedPassport = schemaEncoder.encodeData([
        { name: "providers", value: fullBitMap, type: "uint256[]" },
        { name: "hashes", value: hashesOverride, type: "bytes32[]" },
        {
          name: "issuanceDates",
          value: issuanceDatesOverride,
          type: "uint64[]",
        },
        {
          name: "expirationDates",
          value: expirationDatesOverride,
          type: "uint64[]",
        },
        {
          name: "providerMapVersion",
          value: providerMapVersion,
          type: "uint16",
        },
      ]);

      const fullPassport = {
        multiAttestationRequest: [
          {
            schema: this.passportSchemaUID,
            data: [
              {
                recipient: this.gasAccount.address,
                expirationTime: 1708741995,
                revocable: true,
                refUID: ZERO_BYTES32,
                data: encodedPassport,
                value: 0,
              },
            ],
          },
        ],
        nonce: await this.getNonce(this.gasAccount.address),
        fee: fee1,
      };

      const signature = await this.iamAccount.signTypedData(
        this.domain,
        passportTypes,
        fullPassport
      );

      const { v, r, s } = ethers.Signature.from(signature);

      // Submit attestations
      const verifiedPassport = await this.gitcoinVerifier.verifyAndAttest(
        fullPassport,
        v,
        r,
        s,
        {
          value: fee1,
        }
      );

      await verifiedPassport.wait();
    });
    it("should set fullProvider as valid in test contract", async function () {
      await this.gitcoinPassportDecoderGasUsage.checkPassport(
        this.gasAccount.address
      );
      const providerStatus =
        await this.gitcoinPassportDecoderGasUsage.hasCredentials(
          this.gasAccount.address
        );
      expect(BigInt(1)).to.equal(providerStatus);
    });
  });
});
