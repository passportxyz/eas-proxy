import { expect } from "chai";
import { ethers } from "hardhat";
import {
  SchemaEncoder,
  ZERO_ADDRESS,
  ZERO_BYTES32,
  Attestation
} from "@ethereum-attestation-service/eas-sdk";
import { SCHEMA_REGISTRY_ABI } from "./abi/SCHEMA_REGISTRY_ABI";
import { schemaRegistryContractAddress } from "./GitcoinResolver";
import {
  getScoreAttestation,
  easEncodeScore
} from "./helpers/mockAttestations";
import {
  AttestationStruct,
  GitcoinResolver
} from "../typechain-types/contracts/GitcoinResolver";
import {
  passportTypes,
  fee1,
  EAS_CONTRACT_ADDRESS
} from "./helpers/verifierTests";

const providers = [BigInt("111")];

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
  )
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
  )
];

const easEncodePassport = () => {
  const schemaEncoder = new SchemaEncoder(
    "uint256[] providers, bytes32[] hashes, uint64[] issuanceDates, uint64[] expirationDates, uint16 providerMapVersion"
  );

  const encodedData = schemaEncoder.encodeData([
    { name: "providers", value: providers, type: "uint256[]" },
    { name: "hashes", value: hashes, type: "bytes32[]" },
    { name: "issuanceDates", value: issuanceDates, type: "uint64[]" },
    { name: "expirationDates", value: expirationDates, type: "uint64[]" },
    { name: "providerMapVersion", value: providerMapVersion, type: "uint16" }
  ]);
  return encodedData;
};

const scoreEasSchema = "uint256 score,uint32 scorer_id,uint8 score_decimals";
const passportEasSchema =
  "uint256[] providers, bytes32[] hashes, uint64[] issuanceDates, uint64[] expirationDates, uint16 providerMapVersion";

const registerSchema = async (
  schemaRegistry: ethers.Contract,
  stampSchemaInput: string,
  resolverAddress: string | undefined
): Promise<string> => {
  const stampSchemaTx = await schemaRegistry.register(
    stampSchemaInput,
    resolverAddress,
    true
  );

  const passportSchemaTxReceipt = await stampSchemaTx.wait();
  const passportSchemaEvent = passportSchemaTxReceipt.logs.filter(
    (log: any) => {
      return log.fragment.name == "Registered";
    }
  );
  return passportSchemaEvent[0].args[0];
};

const easEncodeInvalidStamp = () => {
  const schemaEncoder = new SchemaEncoder(
    "uint256[] providers, bytes32[] hashes, uint64[] issuanceDates, uint64[] expirationDates, uint16 providerMapVersion"
  );

  const encodedData = schemaEncoder.encodeData([
    { name: "providers", value: providers, type: "uint256[]" },
    { name: "hashes", value: invalidHashes, type: "bytes32[]" },
    { name: "issuanceDates", value: invalidIssuanceDates, type: "uint64[]" },
    {
      name: "expirationDates",
      value: invalidExpirationDates,
      type: "uint64[]"
    },
    { name: "providerMapVersion", value: providerMapVersion, type: "uint16" }
  ]);
  return encodedData;
};

describe.only("GitcoinPassportDecoder", function () {
  const maxScoreAge = 3600 * 24 * 90; // 90 days
  let gitcoinResolver: GitcoinResolver;
  let passportSchemaUID: string;

  this.beforeAll(async function () {
    // this.beforeAll(async function () {
    const [ownerAccount, iamAcct, recipientAccount, otherAccount] =
      await ethers.getSigners();

    this.owner = ownerAccount;
    this.iamAccount = iamAcct;
    this.recipient = recipientAccount;
    this.otherAcct = otherAccount;
  });

  this.beforeEach(async function () {
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
      verifyingContract: await this.gitcoinVerifier.getAddress()
    };

    this.getNonce = async (address: string) => {
      return await this.gitcoinVerifier.recipientNonces(address);
    };

    // Deploy GitcoinResolver
    const GitcoinResolver = await ethers.getContractFactory(
      "GitcoinResolver",
      this.owner
    );
    gitcoinResolver = await GitcoinResolver.deploy();

    await gitcoinResolver
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

    passportSchemaUID = await registerSchema(
      schemaRegistry,
      passportEasSchema,
      gitcoinResolver.getAddress()
    );

    this.scoreSchemaUID = await registerSchema(
      schemaRegistry,
      scoreEasSchema,
      gitcoinResolver.getAddress()
    );

    console.log("====> 3");

    this.passport = {
      multiAttestationRequest: [
        {
          schema: passportSchemaUID,
          data: [
            {
              recipient: this.recipient.address,
              expirationTime: 1708741995,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodePassport(),
              value: 0
            }
          ]
        }
      ],
      nonce: await this.getNonce(this.recipient.address),
      fee: fee1
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
              data: easEncodeScore({
                score: 100,
                scorer_id: 1,
                score_decimals: 18
              }),
              value: 0
            }
          ]
        }
      ],
      nonce: await this.getNonce(this.recipient.address),
      fee: fee1
    };

    this.invalidPassport = {
      multiAttestationRequest: [
        {
          schema: passportSchemaUID,
          data: [
            {
              recipient: this.recipient.address,
              expirationTime: 1708741995,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeInvalidStamp(),
              value: 0
            }
          ]
        }
      ],
      nonce: await this.getNonce(this.recipient.address),
      fee: fee1
    };

    const addVerifierResult = await this.gitcoinAttester
      .connect(this.owner)
      .addVerifier(await this.gitcoinVerifier.getAddress());

    await addVerifierResult.wait();

    //////////////////////////////////////////////////////////////////////////////////////////
    // Deploy GitcoinPassportDecoder
    //////////////////////////////////////////////////////////////////////////////////////////
    const GitcoinPassportDecoder = await ethers.getContractFactory(
      "GitcoinPassportDecoder",
      this.owner
    );

    this.gitcoinPassportDecoder = await GitcoinPassportDecoder.deploy();

    await this.gitcoinPassportDecoder.connect(this.owner).initialize();

    // Initialize the sdk with the address of the EAS Schema contract address
    await this.gitcoinPassportDecoder.setEASAddress(EAS_CONTRACT_ADDRESS);
    await this.gitcoinPassportDecoder.setGitcoinResolver(
      gitcoinResolver.getAddress()
    );
    await this.gitcoinPassportDecoder.setPassportSchemaUID(passportSchemaUID);

    await this.gitcoinPassportDecoder.setMaxScoreAge(maxScoreAge); // Sets the max age to 90 days

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

      const savedProviders =
        await this.gitcoinPassportDecoder.getProviders(currentVersion);

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
        "NewStamp2"
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
          value: fee1
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
          value: fee1
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
          value: fee1
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
  describe("getScore", function () {
    describe("get score from attestation", function () {
      beforeEach(async function () {
        const attestation = getScoreAttestation(
          {
            schema: passportSchemaUID,
            recipient: this.recipient.address,
            attester: this.iamAccount.address
          },
          {
            score: "32345678000000000000", // That is 32.345678000000000000 (18 decimals)
            scorer_id: 1,
            score_decimals: 18
          }
        ) as AttestationStruct;

        const gitcoinAttestationRequest = {
          multiAttestationRequest: [
            {
              schema: attestation.schema,
              data: [
                {
                  recipient: attestation.recipient,
                  expirationTime: attestation.expirationTime,
                  revocable: attestation.revocable,
                  refUID: attestation.refUID,
                  data: attestation.data,
                  value: 0
                }
              ]
            }
          ],

          nonce: await this.getNonce(this.recipient.address),
          fee: fee1
        };

        const signature = await this.iamAccount.signTypedData(
          this.domain,
          passportTypes,
          gitcoinAttestationRequest
        );

        const { v, r, s } = ethers.Signature.from(signature);

        // Submit attestations
        const verifiedPassport = await this.gitcoinVerifier.verifyAndAttest(
          gitcoinAttestationRequest,
          v,
          r,
          s,
          {
            value: fee1
          }
        );
      });
      it("should get a user's score", async function () {
        const score = await this.gitcoinPassportDecoder.getScore(
          this.recipient.address
        );
        // We expect the value as a 4 digit decimal
        expect(score).to.equal(323456);
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
                value: 0n
              }
            ]
          }
        ]);

        await expect(
          this.gitcoinPassportDecoder.getScore(this.recipient.address)
        ).to.be.revertedWithCustomError(
          this.gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });
    });

    describe("get score from resolver cache", function () {
      beforeEach(async function () {
        this.gitcoinResolver.setScoreSchema(passportSchemaUID);
        const attestation = getScoreAttestation(
          {
            schema: passportSchemaUID,
            recipient: this.recipient.address,
            attester: this.iamAccount.address
          },
          {
            score: "32345678000000000000", // That is 32.345678000000000000 (18 decimals)
            scorer_id: 1,
            score_decimals: 18
          }
        ) as AttestationStruct;

        const gitcoinAttestationRequest = {
          multiAttestationRequest: [
            {
              schema: attestation.schema,
              data: [
                {
                  recipient: attestation.recipient,
                  expirationTime: attestation.expirationTime,
                  revocable: attestation.revocable,
                  refUID: attestation.refUID,
                  data: attestation.data,
                  value: 0
                }
              ]
            }
          ],

          nonce: await this.getNonce(this.recipient.address),
          fee: fee1
        };

        const signature = await this.iamAccount.signTypedData(
          this.domain,
          passportTypes,
          gitcoinAttestationRequest
        );

        const { v, r, s } = ethers.Signature.from(signature);

        // Submit attestations
        const verifiedPassport = await this.gitcoinVerifier.verifyAndAttest(
          gitcoinAttestationRequest,
          v,
          r,
          s,
          {
            value: fee1
          }
        );
      });
      it("should get a user's score", async function () {
        const score = await this.gitcoinPassportDecoder.getScore(
          this.recipient.address
        );
        // We expect the value as a 4 digit decimal
        expect(score).to.equal(323456);
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
                value: 0n
              }
            ]
          }
        ]);

        await expect(
          this.gitcoinPassportDecoder.getScore(this.recipient.address)
        ).to.be.revertedWithCustomError(
          this.gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });
    });
  });

  describe("isHuman", function () {
    describe("for score from attestation", function () {
      beforeEach(async function () {
        const attestation = getScoreAttestation(
          {
            schema: passportSchemaUID,
            recipient: this.recipient.address,
            attester: this.iamAccount.address
          },
          {
            score: "32345678000000000000", // That is 32.345678000000000000 (18 decimals)
            scorer_id: 1,
            score_decimals: 18
          }
        ) as AttestationStruct;

        const gitcoinAttestationRequest = {
          multiAttestationRequest: [
            {
              schema: attestation.schema,
              data: [
                {
                  recipient: attestation.recipient,
                  expirationTime: attestation.expirationTime,
                  revocable: attestation.revocable,
                  refUID: attestation.refUID,
                  data: attestation.data,
                  value: 0
                }
              ]
            }
          ],

          nonce: await this.getNonce(this.recipient.address),
          fee: fee1
        };

        const signature = await this.iamAccount.signTypedData(
          this.domain,
          passportTypes,
          gitcoinAttestationRequest
        );

        const { v, r, s } = ethers.Signature.from(signature);

        // Submit attestations
        const verifiedPassport = await this.gitcoinVerifier.verifyAndAttest(
          gitcoinAttestationRequest,
          v,
          r,
          s,
          {
            value: fee1
          }
        );
      });

      it("should revert if address has no attested score", async function () {
        await expect(
          this.gitcoinPassportDecoder.isHuman(this.owner.address)
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
                value: 0n
              }
            ]
          }
        ]);

        await expect(
          this.gitcoinPassportDecoder.getScore(this.recipient.address)
        ).to.be.revertedWithCustomError(
          this.gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });

      it("should return true if the score is above the threshold", async function () {
        await this.gitcoinPassportDecoder
          .connect(this.owner)
          .setThreshold(313456);
        const isHuman = await this.gitcoinPassportDecoder.isHuman(
          this.recipient.address
        );
        expect(isHuman).to.equal(true);
      });
      it("should return true if the score is is equal to the threshold", async function () {
        await this.gitcoinPassportDecoder
          .connect(this.owner)
          .setThreshold(323456);
        const isHuman = await this.gitcoinPassportDecoder.isHuman(
          this.recipient.address
        );
        expect(isHuman).to.equal(true);
      });
      it("should return false if the score is below the threshold", async function () {
        await this.gitcoinPassportDecoder
          .connect(this.owner)
          .setThreshold(333456);
        await expect(
          this.gitcoinPassportDecoder.isHuman(this.recipient.address)
        ).to.be.revertedWithCustomError(
          this.gitcoinPassportDecoder,
          "ScoreDoesNotMeetThreshold"
        );
      });
    });

    describe("for score from resolver cache", function () {
      beforeEach(async function () {
        this.gitcoinResolver.setScoreSchema(passportSchemaUID);
        const attestation = getScoreAttestation(
          {
            schema: passportSchemaUID,
            recipient: this.recipient.address,
            attester: this.iamAccount.address
          },
          {
            score: "32345678000000000000", // That is 32.345678000000000000 (18 decimals)
            scorer_id: 1,
            score_decimals: 18
          }
        ) as AttestationStruct;

        const gitcoinAttestationRequest = {
          multiAttestationRequest: [
            {
              schema: attestation.schema,
              data: [
                {
                  recipient: attestation.recipient,
                  expirationTime: attestation.expirationTime,
                  revocable: attestation.revocable,
                  refUID: attestation.refUID,
                  data: attestation.data,
                  value: 0
                }
              ]
            }
          ],

          nonce: await this.getNonce(this.recipient.address),
          fee: fee1
        };

        const signature = await this.iamAccount.signTypedData(
          this.domain,
          passportTypes,
          gitcoinAttestationRequest
        );

        const { v, r, s } = ethers.Signature.from(signature);

        // Submit attestations
        const verifiedPassport = await this.gitcoinVerifier.verifyAndAttest(
          gitcoinAttestationRequest,
          v,
          r,
          s,
          {
            value: fee1
          }
        );
      });

      it("should revert if address has no attested score", async function () {
        await expect(
          this.gitcoinPassportDecoder.isHuman(this.owner.address)
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
                value: 0n
              }
            ]
          }
        ]);

        await expect(
          this.gitcoinPassportDecoder.isHuman(this.recipient.address)
        ).to.be.revertedWithCustomError(
          this.gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });
      it("should return true if the score is above the threshold", async function () {
        await this.gitcoinPassportDecoder
          .connect(this.owner)
          .setThreshold(313456);
        const isHuman = await this.gitcoinPassportDecoder.isHuman(
          this.recipient.address
        );
        expect(isHuman).to.equal(true);
      });
      it("should return true if the score is is equal to the threshold", async function () {
        await this.gitcoinPassportDecoder
          .connect(this.owner)
          .setThreshold(323456);
        const isHuman = await this.gitcoinPassportDecoder.isHuman(
          this.recipient.address
        );
        expect(isHuman).to.equal(true);
      });
      it("should return false if the score is below the threshold", async function () {
        await this.gitcoinPassportDecoder
          .connect(this.owner)
          .setThreshold(333456);
        await expect(
          this.gitcoinPassportDecoder.isHuman(this.recipient.address)
        ).to.be.revertedWithCustomError(
          this.gitcoinPassportDecoder,
          "ScoreDoesNotMeetThreshold"
        );
      });
    });
  });

  describe("Internal functions", function () {
    let gitcoinPassportDecoderInternal: any;

    this.beforeAll(async function () {
      //////////////////////////////////////////////////////////////////////////////////////////
      // Deploy GitcoinPassportDecoderInternal
      // We will use GitcoinPassportDecoderInternal to test internal / private functions
      //////////////////////////////////////////////////////////////////////////////////////////
      const GitcoinPassportDecoderInternal = await ethers.getContractFactory(
        "GitcoinPassportDecoderInternal",
        this.owner
      );
      gitcoinPassportDecoderInternal =
        await GitcoinPassportDecoderInternal.deploy();
      await gitcoinPassportDecoderInternal.connect(this.owner).initialize();
      await gitcoinPassportDecoderInternal.setMaxScoreAge(maxScoreAge); // Sets the max age to 90 days
    });

    describe("_isScoreAttestationExpired", function () {
      let now = 0;
      let attestation: Attestation;

      this.beforeEach(async function () {
        now = Math.floor(new Date().getTime() / 1000);

        // Convert now to integer
        attestation = {
          uid: ZERO_BYTES32,
          schema: ZERO_BYTES32,
          data: easEncodeScore({
            score: 100,
            scorer_id: 1,
            score_decimals: 18
          }),
          expirationTime: now - 3600 * 24, // Current time as seconds. We set this to be 1 day in the past.
          time: now,
          refUID: ZERO_BYTES32,
          revocationTime: 0,
          recipient: ZERO_ADDRESS,
          revocable: false,
          attester: ZERO_ADDRESS
        };
      });

      it("should return true if an attestation has an expiration date and is expired", async function () {
        attestation.expirationTime = now - 3600 * 24; // Current time as seconds. We set this to be 1 day in the past.
        const isExpired =
          await gitcoinPassportDecoderInternal.isScoreAttestationExpired(
            attestation
          );
        expect(isExpired).to.equal(true);
      });

      it("should return false if an attestation has an expiration date and is expired", async function () {
        attestation.expirationTime = now + 3600 * 24; // Current time as seconds. We set this to be 1 day in the future.
        const isExpired =
          await gitcoinPassportDecoderInternal.isScoreAttestationExpired(
            attestation
          );
        expect(isExpired).to.equal(false);
      });

      it("should return true if an attestation has NO expiration date and expiration is determined based on issuance date", async function () {
        attestation.expirationTime = 0; // Current time as seconds. We set this to be 1 day in the past.
        attestation.time = now - maxScoreAge - 3600; // Make the attestation older than max age
        const isExpired =
          await gitcoinPassportDecoderInternal.isScoreAttestationExpired(
            attestation
          );
        expect(isExpired).to.equal(true);
      });

      it("should return false if an attestation has NO expiration date and it is not expired based based on issuance date and max age", async function () {
        attestation.expirationTime = 0; // Current time as seconds. We set this to be 1 day in the future.
        attestation.time = now - maxScoreAge + 3600; // Make the attestation younger than max age
        const isExpired =
          await gitcoinPassportDecoderInternal.isScoreAttestationExpired(
            attestation
          );
        expect(isExpired).to.equal(false);
      });
    });

    describe("_isCachedScoreExpired", function () {
      let now = 0;
      let cachedScore: {
        score: number;
        time: number;
        expirationTime: number;
      };

      this.beforeEach(async function () {
        now = Math.floor(new Date().getTime() / 1000);

        // Convert now to integer
        cachedScore = {
          score: 123,
          expirationTime: now - 3600 * 24, // Current time as seconds. We set this to be 1 day in the past.
          time: now
        };
      });

      it("should return true if an cachedScore has an expiration date and is expired", async function () {
        cachedScore.expirationTime = now - 3600 * 24; // Unset expiration time
        const isExpired =
          await gitcoinPassportDecoderInternal.isCachedScoreExpired(
            cachedScore
          );
        expect(isExpired).to.equal(true);
      });

      it("should return false if an cachedScore has an expiration date and is expired", async function () {
        cachedScore.expirationTime = now + 3600 * 24; // Unset expiration time
        const isExpired =
          await gitcoinPassportDecoderInternal.isCachedScoreExpired(
            cachedScore
          );
        expect(isExpired).to.equal(false);
      });

      it("should return true if a score has NO expiration date and expiration is determined based on issuance date", async function () {
        cachedScore.expirationTime = 0; // Unset expiration time
        cachedScore.time = now - maxScoreAge - 3600; // Make the attestation older than max age
        const isExpired =
          await gitcoinPassportDecoderInternal.isCachedScoreExpired(
            cachedScore
          );
        expect(isExpired).to.equal(true);
      });

      it("should return false if a score has NO expiration date and it is not expired based based on issuance date and max age", async function () {
        cachedScore.expirationTime = 0; // Unset expiration time
        cachedScore.time = now - maxScoreAge + 3600; // Make the attestation younger than max age
        const isExpired =
          await gitcoinPassportDecoderInternal.isCachedScoreExpired(
            cachedScore
          );
        expect(isExpired).to.equal(false);
      });
    });
  });
});
