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
import {
  GitcoinAttester,
  GitcoinPassportDecoder,
  GitcoinVerifier
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

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

describe("GitcoinPassportDecoder", function () {
  const maxScoreAge = 3600 * 24 * 90; // 90 days
  let gitcoinResolver: GitcoinResolver;
  let gitcoinAttester: GitcoinAttester;
  let gitcoinVerifier: GitcoinVerifier;
  let gitcoinPassportDecoder: GitcoinPassportDecoder;
  let passportSchemaUID: string;
  let scoreSchemaUID: string;
  let ownerAccount: HardhatEthersSigner;
  let iamAccount: HardhatEthersSigner;
  let recipientAccount: HardhatEthersSigner;
  let otherAccount: HardhatEthersSigner;

  this.beforeAll(async function () {
    [ownerAccount, iamAccount, recipientAccount, otherAccount] =
      await ethers.getSigners();
  });

  this.beforeEach(async function () {
    //////////////////////////////////////////////////////////////////////////////////////////
    // Deploy GitcoinAttester
    //////////////////////////////////////////////////////////////////////////////////////////
    const GitcoinAttester = await ethers.getContractFactory(
      "GitcoinAttester",
      ownerAccount
    );
    gitcoinAttester = await GitcoinAttester.deploy();
    await gitcoinAttester.connect(ownerAccount).initialize();

    await gitcoinAttester.setEASAddress(EAS_CONTRACT_ADDRESS);

    //////////////////////////////////////////////////////////////////////////////////////////
    // Deploy GitcoinVerifier
    //////////////////////////////////////////////////////////////////////////////////////////
    const GitcoinVerifier = await ethers.getContractFactory(
      "GitcoinVerifier",
      ownerAccount
    );
    gitcoinVerifier = await GitcoinVerifier.deploy();

    await gitcoinVerifier
      .connect(ownerAccount)
      .initialize(
        await iamAccount.getAddress(),
        await gitcoinAttester.getAddress()
      );

    const chainId = await ethers.provider
      .getNetwork()
      .then((n: { chainId: any }) => n.chainId);

    this.domain = {
      name: "GitcoinVerifier",
      version: "1",
      chainId,
      verifyingContract: await gitcoinVerifier.getAddress()
    };

    this.getNonce = async (address: string) => {
      return await gitcoinVerifier.recipientNonces(address);
    };

    // Register the verifier in the attester
    const addVerifierResult = await gitcoinAttester.addVerifier(
      await gitcoinVerifier.getAddress()
    );

    //////////////////////////////////////////////////////////////////////////////////////////
    // Deploy GitcoinResolver
    //////////////////////////////////////////////////////////////////////////////////////////
    const GitcoinResolver = await ethers.getContractFactory(
      "GitcoinResolver",
      ownerAccount
    );
    gitcoinResolver = await GitcoinResolver.deploy();

    await gitcoinResolver
      .connect(ownerAccount)
      .initialize(EAS_CONTRACT_ADDRESS, await gitcoinAttester.getAddress());

    //////////////////////////////////////////////////////////////////////////////////////////
    // Deploy schemas to registry
    //////////////////////////////////////////////////////////////////////////////////////////
    const schemaRegistry = new ethers.Contract(
      ethers.getAddress(schemaRegistryContractAddress),
      SCHEMA_REGISTRY_ABI,
      ownerAccount
    );

    passportSchemaUID = await registerSchema(
      schemaRegistry,
      passportEasSchema,
      await gitcoinResolver.getAddress()
    );

    scoreSchemaUID = await registerSchema(
      schemaRegistry,
      scoreEasSchema,
      await gitcoinResolver.getAddress()
    );

    //////////////////////////////////////////////////////////////////////////////////////////
    // Deploy GitcoinPassportDecoder
    //////////////////////////////////////////////////////////////////////////////////////////
    const GitcoinPassportDecoder = await ethers.getContractFactory(
      "GitcoinPassportDecoder",
      ownerAccount
    );

    gitcoinPassportDecoder = await GitcoinPassportDecoder.deploy();
    await gitcoinPassportDecoder.connect(ownerAccount).initialize();
    // Initialize the sdk with the address of the EAS Schema contract address
    await gitcoinPassportDecoder.setEASAddress(EAS_CONTRACT_ADDRESS);
    await gitcoinPassportDecoder.setGitcoinResolver(
      gitcoinResolver.getAddress()
    );
    await gitcoinPassportDecoder.setPassportSchemaUID(passportSchemaUID);
    await gitcoinPassportDecoder.setMaxScoreAge(maxScoreAge); // Sets the max age to 90 days
    await gitcoinPassportDecoder.setScoreSchemaUID(scoreSchemaUID);
  });

  describe("Adding new providers to current version of providers", async function () {
    it("should append a provider to the end of an existing provider mapping", async function () {
      const providers = ["NewStamp1", "NewStamp2"];

      await gitcoinPassportDecoder
        .connect(ownerAccount)
        .addProviders(providers);

      await gitcoinPassportDecoder
        .connect(ownerAccount)
        .addProviders(["NewStamp3"]);

      const currentVersion = await gitcoinPassportDecoder.currentVersion();

      const lastProvider = await gitcoinPassportDecoder.providerVersions(
        currentVersion,
        2
      );

      expect(lastProvider === "NewStamp3");
    });

    it("should return provider given a version", async function () {
      const providers = ["NewStamp1", "NewStamp2"];
      await gitcoinPassportDecoder
        .connect(ownerAccount)
        .addProviders(providers);

      const currentVersion = await gitcoinPassportDecoder.currentVersion();

      const savedProviders =
        await gitcoinPassportDecoder.getProviders(currentVersion);

      expect(savedProviders.length === providers.length);
      expect(savedProviders).to.eql(providers);
    });

    it("should not allow anyone other than owner to append new providers array in the provider mapping", async function () {
      await expect(
        gitcoinPassportDecoder
          .connect(recipientAccount)
          .addProviders(["NewStamp3"])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should throw an error when trying to add the same provider twice in different function calls", async function () {
      const providersForCall1 = ["NewStamp1", "NewStamp2"];
      const providersForCall2 = ["NewStamp3", "NewStamp2"];

      await gitcoinPassportDecoder
        .connect(ownerAccount)
        .addProviders(providersForCall1);

      await expect(
        gitcoinPassportDecoder
          .connect(ownerAccount)
          .addProviders(providersForCall2)
      ).to.be.revertedWithCustomError(
        gitcoinPassportDecoder,
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
        gitcoinPassportDecoder
          .connect(ownerAccount)
          .addProviders(providersForCall1)
      ).to.be.revertedWithCustomError(
        gitcoinPassportDecoder,
        "ProviderAlreadyExists"
      );
    });

    it("should throw an error when trying to add a provider with a zero value", async function () {
      const providersForCall1 = [""];
      await expect(
        gitcoinPassportDecoder
          .connect(ownerAccount)
          .addProviders(providersForCall1)
      ).to.be.revertedWithCustomError(gitcoinPassportDecoder, "EmptyProvider");
    });

    it("should allow adding providers with the same name but different version", async function () {
      await gitcoinPassportDecoder
        .connect(ownerAccount)
        .addProviders(["NewStamp1", "NewStamp2"]);

      const currentVersion = await gitcoinPassportDecoder.currentVersion();

      const lastProvider = await gitcoinPassportDecoder.providerVersions(
        currentVersion,
        1
      );

      expect(lastProvider === "NewStamp2");

      await gitcoinPassportDecoder
        .connect(ownerAccount)
        .createNewVersion(["NewStamp1"]);

      await gitcoinPassportDecoder
        .connect(ownerAccount)
        .addProviders(["NewStamp2"]);

      const updatedVersion = await gitcoinPassportDecoder.currentVersion();

      const updatedLastProvider = await gitcoinPassportDecoder.providerVersions(
        updatedVersion,
        1
      );

      expect(updatedLastProvider === "NewStamp2");
    });
  });

  describe("Decoding Passports", async function () {
    // providers that were created in previous tests
    const providers = ["NewStamp1", "NewStamp2", "NewStamp3"];
    let passport: GitcoinVerifier.PassportAttestationRequestStruct;
    let invalidPassport: GitcoinVerifier.PassportAttestationRequestStruct;
    this.beforeEach(async function () {
      passport = {
        multiAttestationRequest: [
          {
            schema: passportSchemaUID,
            data: [
              {
                recipient: recipientAccount.address,
                expirationTime: 1708741995,
                revocable: true,
                refUID: ZERO_BYTES32,
                data: easEncodePassport(),
                value: 0
              }
            ]
          }
        ],
        nonce: await this.getNonce(recipientAccount.address),
        fee: fee1
      };

      invalidPassport = {
        multiAttestationRequest: [
          {
            schema: passportSchemaUID,
            data: [
              {
                recipient: recipientAccount.address,
                expirationTime: 1708741995,
                revocable: true,
                refUID: ZERO_BYTES32,
                data: easEncodeInvalidStamp(),
                value: 0
              }
            ]
          }
        ],
        nonce: await this.getNonce(recipientAccount.address),
        fee: fee1
      };

      passport.nonce = await gitcoinVerifier.recipientNonces(
        passport.multiAttestationRequest[0].data[0].recipient
      );
    });

    it("should decode a user's passport", async function () {
      const signature = await iamAccount.signTypedData(
        this.domain,
        passportTypes,
        passport
      );

      const { v, r, s } = ethers.Signature.from(signature);

      await gitcoinPassportDecoder
        .connect(ownerAccount)
        .addProviders(providers);

      // Submit attestations
      const verifiedPassport = await gitcoinVerifier.verifyAndAttest(
        passport,
        v,
        r,
        s,
        {
          value: fee1
        }
      );

      await verifiedPassport.wait();

      const passportTx = await gitcoinPassportDecoder
        .connect(ownerAccount)
        .getPassport(recipientAccount.address);

      expect(passportTx.length === providers.length);

      passportTx.forEach((cred: any, i: number) => {
        expect(cred[0]).to.equal(providers[i]);
        expect(ethers.getBytes(cred[1])).to.eql(hashes[i]);
        expect(cred[2]).to.equal(issuanceDates[i]);
        expect(cred[3]).to.equal(expirationDates[i]);
      });
    });

    it("should allow non-owners to decode a user's passport", async function () {
      const signature = await iamAccount.signTypedData(
        this.domain,
        passportTypes,
        passport
      );

      const { v, r, s } = ethers.Signature.from(signature);

      await gitcoinPassportDecoder
        .connect(ownerAccount)
        .addProviders(providers);

      // Submit attestations
      const verifiedPassport = await gitcoinVerifier.verifyAndAttest(
        passport,
        v,
        r,
        s,
        {
          value: fee1
        }
      );

      await verifiedPassport.wait();

      const passportTx = await gitcoinPassportDecoder
        .connect(otherAccount)
        .getPassport(recipientAccount.address);

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
      invalidPassport.nonce = await gitcoinVerifier.recipientNonces(
        invalidPassport.multiAttestationRequest[0].data[0].recipient
      );

      const signature = await iamAccount.signTypedData(
        this.domain,
        passportTypes,
        invalidPassport
      );

      const { v, r, s } = ethers.Signature.from(signature);

      // Submit attestations
      const verifiedPassport = await gitcoinVerifier.verifyAndAttest(
        invalidPassport,
        v,
        r,
        s,
        {
          value: fee1
        }
      );

      await verifiedPassport.wait();

      expect(
        gitcoinPassportDecoder
          .connect(ownerAccount)
          .getPassport(recipientAccount.address)
      ).to.be.revertedWithPanic();
    });
  });
  describe("Creating new versions", function () {
    it("should add new providers to the providers mapping and increment the version", async function () {
      const providers = ["NewStamp1", "NewStamp2"];
      // Get the 0th version
      const versionZero = await gitcoinPassportDecoder.currentVersion();

      expect(versionZero).to.equal("0");

      await gitcoinPassportDecoder
        .connect(ownerAccount)
        .createNewVersion(providers);

      // Get the current version
      const currentVersion = await gitcoinPassportDecoder.currentVersion();

      expect(currentVersion).to.equal("1");

      const firstProvider = await gitcoinPassportDecoder.providerVersions(
        currentVersion,
        0
      );

      expect(firstProvider === providers[0]);
    });

    it("should not allow anyone other than owner to add new providers to the mapping", async function () {
      const providers = ["NewStamp1", "NewStamp2"];
      // Get the 0th version
      const versionZero = await gitcoinPassportDecoder.currentVersion();

      expect(versionZero).to.equal("0");

      await expect(
        gitcoinPassportDecoder.connect(recipientAccount).addProviders(providers)
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
        await gitcoinPassportDecoder
          .connect(ownerAccount)
          [functionName](mockValue);
      });

      it(`should not allow anyone other than owner to set the ${addressConstant}`, async function () {
        await expect(
          gitcoinPassportDecoder
            .connect(recipientAccount)
            [functionName](mockValue)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it(`should not allow ${addressConstant} to be set to zero address`, async function () {
        await expect(
          gitcoinPassportDecoder
            .connect(ownerAccount)
            [functionName](addressParam ? ZERO_ADDRESS : ZERO_BYTES32)
        ).to.be.revertedWithCustomError(gitcoinPassportDecoder, error);
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
            schema: scoreSchemaUID,
            recipient: recipientAccount.address,
            attester: iamAccount.address
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

          nonce: await this.getNonce(recipientAccount.address),
          fee: fee1
        };

        const signature = await iamAccount.signTypedData(
          this.domain,
          passportTypes,
          gitcoinAttestationRequest
        );

        const { v, r, s } = ethers.Signature.from(signature);

        // Submit attestations
        const verifiedPassport = await gitcoinVerifier.verifyAndAttest(
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
        const score = await gitcoinPassportDecoder.getScore(
          recipientAccount.address
        );
        // We expect the value as a 4 digit decimal
        expect(score).to.equal(323456);
      });
      it("should revert if address has no attested score", async function () {
        await expect(
          gitcoinPassportDecoder.getScore(ownerAccount.address)
        ).to.be.revertedWithCustomError(
          gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });
      it("should revert if attestation is revoked", async function () {
        const scoreAttestation = await gitcoinResolver.getUserAttestation(
          recipientAccount.address,
          scoreSchemaUID
        );
        await gitcoinAttester.revokeAttestations([
          {
            schema: scoreSchemaUID,
            data: [
              {
                uid: scoreAttestation,
                value: 0n
              }
            ]
          }
        ]);

        await expect(
          gitcoinPassportDecoder.getScore(recipientAccount.address)
        ).to.be.revertedWithCustomError(
          gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });
    });

    describe("get score from resolver cache", function () {
      beforeEach(async function () {
        gitcoinResolver.setScoreSchema(passportSchemaUID);
        const attestation = getScoreAttestation(
          {
            schema: scoreSchemaUID,
            recipient: recipientAccount.address,
            attester: iamAccount.address
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

          nonce: await this.getNonce(recipientAccount.address),
          fee: fee1
        };

        const signature = await iamAccount.signTypedData(
          this.domain,
          passportTypes,
          gitcoinAttestationRequest
        );

        const { v, r, s } = ethers.Signature.from(signature);

        // Submit attestations
        const verifiedPassport = await gitcoinVerifier.verifyAndAttest(
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
        const score = await gitcoinPassportDecoder.getScore(
          recipientAccount.address
        );
        // We expect the value as a 4 digit decimal
        expect(score).to.equal(323456);
      });
      it("should revert if address has no attested score", async function () {
        await expect(
          gitcoinPassportDecoder.getScore(ownerAccount.address)
        ).to.be.revertedWithCustomError(
          gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });
      it("should revert if attestation is revoked", async function () {
        const scoreAttestation = await gitcoinResolver.getUserAttestation(
          recipientAccount.address,
          scoreSchemaUID
        );
        await gitcoinAttester.revokeAttestations([
          {
            schema: scoreSchemaUID,
            data: [
              {
                uid: scoreAttestation,
                value: 0n
              }
            ]
          }
        ]);

        await expect(
          gitcoinPassportDecoder.getScore(recipientAccount.address)
        ).to.be.revertedWithCustomError(
          gitcoinPassportDecoder,
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
            schema: scoreSchemaUID,
            recipient: recipientAccount.address,
            attester: iamAccount.address
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

          nonce: await this.getNonce(recipientAccount.address),
          fee: fee1
        };

        const signature = await iamAccount.signTypedData(
          this.domain,
          passportTypes,
          gitcoinAttestationRequest
        );

        const { v, r, s } = ethers.Signature.from(signature);

        // Submit attestations
        const verifiedPassport = await gitcoinVerifier.verifyAndAttest(
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
          gitcoinPassportDecoder.isHuman(ownerAccount.address)
        ).to.be.revertedWithCustomError(
          gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });
      it("should revert if attestation is revoked", async function () {
        const scoreAttestation = await gitcoinResolver.getUserAttestation(
          recipientAccount.address,
          scoreSchemaUID
        );
        await gitcoinAttester.revokeAttestations([
          {
            schema: scoreSchemaUID,
            data: [
              {
                uid: scoreAttestation,
                value: 0n
              }
            ]
          }
        ]);

        await expect(
          gitcoinPassportDecoder.getScore(recipientAccount.address)
        ).to.be.revertedWithCustomError(
          gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });

      it("should return true if the score is above the threshold", async function () {
        await gitcoinPassportDecoder.connect(ownerAccount).setThreshold(313456);
        const isHuman = await gitcoinPassportDecoder.isHuman(
          recipientAccount.address
        );
        expect(isHuman).to.equal(true);
      });
      it("should return true if the score is is equal to the threshold", async function () {
        await gitcoinPassportDecoder.connect(ownerAccount).setThreshold(323456);
        const isHuman = await gitcoinPassportDecoder.isHuman(
          recipientAccount.address
        );
        expect(isHuman).to.equal(true);
      });
      it("should return false if the score is below the threshold", async function () {
        await gitcoinPassportDecoder.connect(ownerAccount).setThreshold(333456);
        await expect(
          gitcoinPassportDecoder.isHuman(recipientAccount.address)
        ).to.be.revertedWithCustomError(
          gitcoinPassportDecoder,
          "ScoreDoesNotMeetThreshold"
        );
      });
    });

    describe("for score from resolver cache", function () {
      beforeEach(async function () {
        gitcoinResolver.setScoreSchema(passportSchemaUID);
        const attestation = getScoreAttestation(
          {
            schema: scoreSchemaUID,
            recipient: recipientAccount.address,
            attester: iamAccount.address
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

          nonce: await this.getNonce(recipientAccount.address),
          fee: fee1
        };

        const signature = await iamAccount.signTypedData(
          this.domain,
          passportTypes,
          gitcoinAttestationRequest
        );

        const { v, r, s } = ethers.Signature.from(signature);

        // Submit attestations
        const verifiedPassport = await gitcoinVerifier.verifyAndAttest(
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
          gitcoinPassportDecoder.isHuman(ownerAccount.address)
        ).to.be.revertedWithCustomError(
          gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });
      it("should revert if attestation is revoked", async function () {
        const scoreAttestation = await gitcoinResolver.getUserAttestation(
          recipientAccount.address,
          scoreSchemaUID
        );
        await gitcoinAttester.revokeAttestations([
          {
            schema: scoreSchemaUID,
            data: [
              {
                uid: scoreAttestation,
                value: 0n
              }
            ]
          }
        ]);

        await expect(
          gitcoinPassportDecoder.isHuman(recipientAccount.address)
        ).to.be.revertedWithCustomError(
          gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });
      it("should return true if the score is above the threshold", async function () {
        await gitcoinPassportDecoder.connect(ownerAccount).setThreshold(313456);
        const isHuman = await gitcoinPassportDecoder.isHuman(
          recipientAccount.address
        );
        expect(isHuman).to.equal(true);
      });
      it("should return true if the score is is equal to the threshold", async function () {
        await gitcoinPassportDecoder.connect(ownerAccount).setThreshold(323456);
        const isHuman = await gitcoinPassportDecoder.isHuman(
          recipientAccount.address
        );
        expect(isHuman).to.equal(true);
      });
      it("should return false if the score is below the threshold", async function () {
        await gitcoinPassportDecoder.connect(ownerAccount).setThreshold(333456);
        await expect(
          gitcoinPassportDecoder.isHuman(recipientAccount.address)
        ).to.be.revertedWithCustomError(
          gitcoinPassportDecoder,
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
        ownerAccount
      );
      gitcoinPassportDecoderInternal =
        await GitcoinPassportDecoderInternal.deploy();
      await gitcoinPassportDecoderInternal.connect(ownerAccount).initialize();
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
