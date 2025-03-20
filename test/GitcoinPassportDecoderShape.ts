import { expect } from "chai";
import { ethers } from "hardhat";
import {
  SchemaEncoder,
  ZERO_BYTES32
} from "@ethereum-attestation-service/eas-sdk";
import { SCHEMA_REGISTRY_ABI } from "./abi/SCHEMA_REGISTRY_ABI";
import { schemaRegistryContractAddress } from "./GitcoinResolver";
import { getScoreAttestation } from "./helpers/mockAttestations";
import {
  AttestationStruct,
  GitcoinResolver
} from "../typechain-types/contracts/GitcoinResolver";
import {
  passportTypes,
  fee1,
  EAS_CONTRACT_ADDRESS,
  daysFromNow
} from "./helpers/verifierTests";
import {
  GitcoinAttester,
  GitcoinPassportDecoderShape,
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

export const scoreV2EasSchema =
  "bool passing_score, uint8 score_decimals, uint128 scorer_id, uint32 score, uint32 threshold, tuple(string provider, uint256 score)[] stamps";

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

// TODO
describe.only("GitcoinPassportDecoderShape", function () {
  const maxScoreAge = 3600 * 24 * 90; // 90 days
  let gitcoinResolver: GitcoinResolver;
  let gitcoinAttester: GitcoinAttester;
  let gitcoinVerifier: GitcoinVerifier;
  let gitcoinPassportDecoder: GitcoinPassportDecoderShape;
  let passportSchemaUID: string;
  let scoreSchemaUID: string;
  let scoreV2SchemaUID: string;
  let ownerAccount: HardhatEthersSigner;
  let iamAccount: HardhatEthersSigner;
  let recipientAccount: HardhatEthersSigner;
  let otherAccount: HardhatEthersSigner;

  // Define the schema for V2 scores
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

    scoreV2SchemaUID = await registerSchema(
      schemaRegistry,
      scoreV2EasSchema,
      await gitcoinResolver.getAddress()
    );

    //////////////////////////////////////////////////////////////////////////////////////////
    // Deploy GitcoinPassportDecoderShape
    //////////////////////////////////////////////////////////////////////////////////////////
    const GitcoinPassportDecoderShape = await ethers.getContractFactory(
      "GitcoinPassportDecoderShape",
      ownerAccount
    );

    gitcoinPassportDecoder = await GitcoinPassportDecoderShape.deploy();
    await gitcoinPassportDecoder.connect(ownerAccount).initialize();
    // Initialize the sdk with the address of the EAS Schema contract address
    await gitcoinPassportDecoder.setEASAddress(EAS_CONTRACT_ADDRESS);
    await gitcoinPassportDecoder.setGitcoinResolver(
      gitcoinResolver.getAddress()
    );
    await gitcoinPassportDecoder.setPassportSchemaUID(passportSchemaUID);
    await gitcoinPassportDecoder.setMaxScoreAge(maxScoreAge); // Sets the max age to 90 days
    await gitcoinPassportDecoder.setScoreSchemaUID(scoreSchemaUID);
    await gitcoinPassportDecoder.setScoreV2SchemaUID(scoreV2SchemaUID);

    await gitcoinResolver.setDefaultCommunityId(1);
    await gitcoinResolver.setScoreSchema(scoreSchemaUID);
    await gitcoinResolver.setScoreV2Schema(scoreV2SchemaUID);
  });

  // Helper function to encode V2 score attestation data
  const easEncodeScoreV2 = ({
    passing_score,
    score_decimals,
    scorer_id,
    score,
    threshold,
    stamps
  }: {
    passing_score: boolean;
    score_decimals: bigint;
    scorer_id: bigint;
    score: bigint;
    threshold: bigint;
    stamps: { provider: string; score: bigint }[];
  }) => {
    const schemaEncoder = new SchemaEncoder(scoreV2EasSchema);

    const encodedData = schemaEncoder.encodeData([
      { name: "passing_score", value: passing_score, type: "bool" },
      { name: "score_decimals", value: score_decimals, type: "uint8" },
      { name: "scorer_id", value: scorer_id, type: "uint128" },
      { name: "score", value: score, type: "uint32" },
      { name: "threshold", value: threshold, type: "uint32" },
      {
        name: "stamps",
        value: stamps,
        type: "(string,uint256)[]"
      }
    ]);
    return encodedData;
  };

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
                expirationTime: daysFromNow(10),
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
                expirationTime: daysFromNow(10),
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
  });

  describe("getScore", function () {
    describe("get score from resolver cache", function () {
      beforeEach(async function () {
        const attestation = getScoreAttestation(
          {
            schema: scoreSchemaUID,
            recipient: recipientAccount.address,
            attester: iamAccount.address
          },
          {
            score: "32345678000000000000", // That is 32.345678000000000000 (18 decimals)
            scorer_id: 7922,
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
        const score = await gitcoinPassportDecoder["getScore(uint32,address)"](
          7922,
          recipientAccount.address
        );
        // We expect the value as a 4 digit decimal
        expect(score).to.equal(323456);
      });
      it("should revert if address has no attested score", async function () {
        await expect(
          gitcoinPassportDecoder["getScore(uint32,address)"](
            7922,
            ownerAccount.address
          )
        ).to.be.revertedWithCustomError(
          gitcoinPassportDecoder,
          "AttestationNotFound"
        );
      });
    });
  });

  describe("getPassport with ScoreV2 format", function () {
    const providerNames = [
      "githubContributionActivityGte#60",
      "NFTScore#75",
      "NFTScore#50",
      "HolonymGovIdProvider",
      "CivicUniquenessPass",
      "BinanceBABT2"
    ];
    const stamps = providerNames.map((provider) => ({
      provider,
      score: BigInt("110000")
    }));
    const expirationTime = daysFromNow(10);

    describe("with a passing score", function () {
      beforeEach(async function () {
        // Create a V2 score attestation
        const data1 = easEncodeScoreV2({
          passing_score: true,
          score_decimals: BigInt(5),
          scorer_id: BigInt(7922),
          score: BigInt("330000"),
          threshold: BigInt("300000"),
          stamps
        });

        // Create another, in a different community
        const data2 = easEncodeScoreV2({
          passing_score: true,
          score_decimals: BigInt(5),
          scorer_id: BigInt(2),
          score: BigInt("660000"),
          threshold: BigInt("300000"),
          stamps: stamps.map((stamp) => ({ ...stamp, score: BigInt("220000") }))
        });

        const attestationRequest = {
          multiAttestationRequest: [
            {
              schema: scoreV2SchemaUID,
              data: [
                {
                  recipient: recipientAccount.address,
                  expirationTime,
                  revocable: true,
                  refUID: ZERO_BYTES32,
                  data: data1,
                  value: 0
                }
              ]
            },
            {
              schema: scoreV2SchemaUID,
              data: [
                {
                  recipient: recipientAccount.address,
                  expirationTime,
                  revocable: true,
                  refUID: ZERO_BYTES32,
                  data: data2,
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
          attestationRequest
        );

        const { v, r, s } = ethers.Signature.from(signature);

        // Submit attestations
        await (
          await gitcoinVerifier.verifyAndAttest(attestationRequest, v, r, s, {
            value: fee1
          })
        ).wait();
      });

      it("should fetch passport from ScoreV2 schema", async function () {
        // Uses 7922 by default
        const passport = await gitcoinPassportDecoder.getPassport(
          recipientAccount.address
        );

        // Check that we have the right number of credentials
        expect(passport.length).to.equal(providerNames.length);

        // Check the credential properties
        for (let i = 0; i < passport.length; i++) {
          expect(passport[i].provider).to.equal(providerNames[i]);
          expect(passport[i].expirationTime).to.equal(expirationTime);
          expect(passport[i].hash).not.to.equal(ZERO_BYTES32);
        }
      });

      it("should get a user's score in a community", async function () {
        const score = await gitcoinPassportDecoder["getScore(uint32,address)"](
          7922,
          recipientAccount.address
        );
        // We expect the value as a 4 digit decimal
        expect(score).to.equal(33000);
      });

      it("should get a user's score in another community", async function () {
        const score = await gitcoinPassportDecoder["getScore(uint32,address)"](
          2,
          recipientAccount.address
        );
        // We expect the value as a 4 digit decimal
        expect(score).to.equal(66000);
      });
    });
  });
});
