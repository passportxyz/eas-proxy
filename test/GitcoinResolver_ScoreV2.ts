import { expect } from "chai";
import { ethers } from "hardhat";
import {
  ZERO_BYTES32,
  NO_EXPIRATION
} from "@ethereum-attestation-service/eas-sdk";
import { GitcoinAttester, GitcoinResolver } from "../typechain-types";
import { encodedData, getScoreAttestation } from "./helpers/mockAttestations";
import { AttestationStruct } from "../typechain-types/contracts/GitcoinResolver";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// Helper function to create ScoreV2 attestation data
function getScoreV2Attestation(
  attestationParams: any,
  scoreParams: {
    passing_score: boolean;
    score_decimals: number;
    scorer_id: number;
    score: number;
    threshold: number;
    stamps: Stamp[];
  }
): AttestationStruct {
  // Convert stamps array to match expected format
  const data = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "bool",
      "uint8",
      "uint128",
      "uint32",
      "uint32",
      "uint48",
      "tuple(string provider, uint256 score)[]"
    ],
    [
      scoreParams.passing_score,
      scoreParams.score_decimals,
      scoreParams.scorer_id,
      scoreParams.score,
      scoreParams.threshold,
      0, // Submission time, using 0 as default
      scoreParams.stamps
    ]
  );

  return {
    uid:
      attestationParams.uid ||
      ethers.keccak256(ethers.toUtf8Bytes("scoreV2-test")),
    schema: attestationParams.schema,
    time: attestationParams.time || NO_EXPIRATION,
    expirationTime: attestationParams.expirationTime || NO_EXPIRATION,
    revocationTime: attestationParams.revocationTime || NO_EXPIRATION,
    refUID: attestationParams.refUID || ZERO_BYTES32,
    recipient: attestationParams.recipient,
    attester: attestationParams.attester,
    revocable: attestationParams.revocable || true,
    data
  };
}

// Define a Stamp type to match the contract
interface Stamp {
  provider: string;
  score: number;
}

describe("GitcoinResolver - ScoreV2", function () {
  let owner: any,
    iamAccount: any,
    recipient: any,
    nonOwnerOrVerifier: any,
    mockEas: any,
    gitcoinResolver: GitcoinResolver,
    gitcoinAttester: GitcoinAttester,
    recipients: HardhatEthersSigner[],
    nextRecipientIndex: number = 0,
    scoreV2SchemaId: string;

  this.beforeEach(async function () {
    // Make sure to use a different recipient for each test
    recipient = recipients[nextRecipientIndex++];
  });

  before(async function () {
    const [
      _ownerAccount,
      _iamAccount,
      _recipientAccount,
      _mockEasContractAccount,
      _nonOwnerOrVerifierAccount,
      ...moreSigners
    ] = await ethers.getSigners();

    owner = _ownerAccount;
    iamAccount = _iamAccount;
    mockEas = _mockEasContractAccount;
    nonOwnerOrVerifier = _nonOwnerOrVerifierAccount;
    recipients = moreSigners;

    const GitcoinAttester = await ethers.getContractFactory(
      "GitcoinAttester",
      owner
    );
    gitcoinAttester = await GitcoinAttester.deploy();
    await gitcoinAttester.connect(owner).initialize();
    const gitcoinAttesterAddress = await gitcoinAttester.getAddress();

    // Initialize the sdk with the address of the EAS Schema contract address
    await gitcoinAttester.setEASAddress(mockEas);

    const GitcoinResolver = await ethers.getContractFactory(
      "GitcoinResolver",
      owner
    );
    gitcoinResolver = await GitcoinResolver.deploy();
    await gitcoinResolver
      .connect(owner)
      .initialize(mockEas.address, gitcoinAttesterAddress);

    const gitcoinResolverAddress = await gitcoinResolver.getAddress();

    // Register SchemaV2
    // For testing purposes, we'll just create a schema ID without actual registry interaction
    scoreV2SchemaId = ethers.keccak256(ethers.toUtf8Bytes("scoreV2Schema"));

    // Set the ScoreV2 schema
    await gitcoinResolver.connect(owner).setScoreV2Schema(scoreV2SchemaId);
  });

  describe("Setup", function () {
    it("should revert if non-owner tries to set a scoreV2 schema", async function () {
      await expect(
        gitcoinResolver
          .connect(nonOwnerOrVerifier)
          .setScoreV2Schema(scoreV2SchemaId)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should emit event when a scoreV2 schema is set", async function () {
      const tx = await gitcoinResolver
        .connect(owner)
        .setScoreV2Schema(scoreV2SchemaId);
      const receipt = await tx.wait();
      const scoreSchemaSetEvent = receipt.logs.filter((log: any) => {
        return log.fragment.name == "ScoreSchemaSet";
      });
      expect(scoreSchemaSetEvent.length).to.equal(1);
      expect(scoreSchemaSetEvent[0].args[0]).to.equal(scoreV2SchemaId);
    });
  });

  describe("Caching ScoreV2", function () {
    it("should cache a scoreV2 and properly reduce the number of decimals when there are more than 4", async function () {
      const stamps: Stamp[] = [
        { provider: "Github", score: 100000 },
        { provider: "Twitter", score: 150000 }
      ];

      const attestation = getScoreV2Attestation(
        {
          schema: scoreV2SchemaId,
          recipient: recipient.address,
          attester: await gitcoinAttester.getAddress(),
          time: 200500,
          expirationTime: 700500
        },
        {
          passing_score: true,
          score_decimals: 8, // 8 decimals
          scorer_id: 1,
          score: 12345678, // 1.2345678 with 8 decimals
          threshold: 10000000,
          stamps
        }
      );

      await gitcoinResolver.connect(mockEas).attest(attestation);

      const score = await gitcoinResolver.getCachedScore(recipient.address);

      // Score should have been reduced to a 4 digit value (12345678 / 10^4 = 1234)
      expect(score[0]).to.equal(1234);
      expect(score[1]).to.equal(200500);
      expect(score[2]).to.equal(700500);
    });

    it("should cache a scoreV2 and properly increase the number of decimals when there are less than 4", async function () {
      const stamps: Stamp[] = [
        { provider: "Github", score: 100000 },
        { provider: "Twitter", score: 150000 }
      ];

      const attestation = getScoreV2Attestation(
        {
          schema: scoreV2SchemaId,
          recipient: recipient.address,
          attester: await gitcoinAttester.getAddress(),
          time: 200500,
          expirationTime: 700500
        },
        {
          passing_score: true,
          score_decimals: 2, // 2 decimals
          scorer_id: 1,
          score: 1234, // 12.34 with 2 decimals
          threshold: 1000,
          stamps
        }
      );

      await gitcoinResolver.connect(mockEas).attest(attestation);

      const score = await gitcoinResolver.getCachedScore(recipient.address);

      // Score should have been expanded to a 4 digit value (1234 * 10^2 = 123400)
      expect(score[0]).to.equal(123400);
      expect(score[1]).to.equal(200500);
      expect(score[2]).to.equal(700500);
    });

    it("should cache a scoreV2 and keep the score unchanged when there are 4 decimals", async function () {
      const stamps: Stamp[] = [
        { provider: "Github", score: 100000 },
        { provider: "Twitter", score: 150000 }
      ];

      const attestation = getScoreV2Attestation(
        {
          schema: scoreV2SchemaId,
          recipient: recipient.address,
          attester: await gitcoinAttester.getAddress(),
          time: 200500,
          expirationTime: 700500
        },
        {
          passing_score: true,
          score_decimals: 4, // 4 decimals
          scorer_id: 1,
          score: 123456, // 12.3456 with 4 decimals
          threshold: 100000,
          stamps
        }
      );

      await gitcoinResolver.connect(mockEas).attest(attestation);

      const score = await gitcoinResolver.getCachedScore(recipient.address);

      // Score should remain unchanged since it already has 4 decimals
      expect(score[0]).to.equal(123456);
      expect(score[1]).to.equal(200500);
      expect(score[2]).to.equal(700500);
    });

    it("should remove a cached scoreV2 if the attestation is revoked", async function () {
      const stamps: Stamp[] = [
        { provider: "Github", score: 100000 },
        { provider: "Twitter", score: 150000 }
      ];

      const attestation = getScoreV2Attestation(
        {
          schema: scoreV2SchemaId,
          recipient: recipient.address,
          attester: await gitcoinAttester.getAddress(),
          time: 200500,
          expirationTime: 700500
        },
        {
          passing_score: true,
          score_decimals: 4,
          scorer_id: 1,
          score: 123456,
          threshold: 100000,
          stamps
        }
      );

      await gitcoinResolver.connect(mockEas).attest(attestation);

      const scoreBeforeRevocation = await gitcoinResolver.getCachedScore(
        recipient.address
      );

      expect(scoreBeforeRevocation[0]).to.equal(123456);

      await gitcoinResolver.connect(mockEas).revoke(attestation);

      const scoreAfterRevocation = await gitcoinResolver.getCachedScore(
        recipient.address
      );

      // Score should be reset to 0
      expect(scoreAfterRevocation[0]).to.equal(0);
      expect(scoreAfterRevocation[1]).to.equal(0);
      expect(scoreAfterRevocation[2]).to.equal(0);
    });
  });

  describe("Community Scores with ScoreV2", function () {
    const defaultCommunityId = 1;
    const testCommunityId = 2;

    before(async function () {
      await gitcoinResolver.setDefaultCommunityId(defaultCommunityId);
    });

    it("should cache default and community specific scores with scoreV2", async function () {
      const defaultStamps: Stamp[] = [
        { provider: "Github", score: 100000 },
        { provider: "Twitter", score: 150000 }
      ];

      const communityStamps: Stamp[] = [
        { provider: "Github", score: 200000 },
        { provider: "Twitter", score: 250000 }
      ];

      // First, verify initial state
      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            defaultCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(0);

      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            testCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(0);

      // Create and attest default community score
      const defaultAttestation = getScoreV2Attestation(
        {
          schema: scoreV2SchemaId,
          recipient: recipient.address,
          attester: await gitcoinAttester.getAddress()
        },
        {
          passing_score: true,
          score_decimals: 4,
          scorer_id: defaultCommunityId,
          score: 12345,
          threshold: 10000,
          stamps: defaultStamps
        }
      );

      await gitcoinResolver.connect(mockEas).attest(defaultAttestation);

      // Check that default community score is set
      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            defaultCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(12345);

      // Check that non-default community score is still 0
      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            testCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(0);

      // Create and attest community-specific score
      const communityAttestation = getScoreV2Attestation(
        {
          schema: scoreV2SchemaId,
          recipient: recipient.address,
          attester: await gitcoinAttester.getAddress()
        },
        {
          passing_score: true,
          score_decimals: 4,
          scorer_id: testCommunityId,
          score: 67890,
          threshold: 10000,
          stamps: communityStamps
        }
      );

      await gitcoinResolver.connect(mockEas).attest(communityAttestation);

      // Check that default community score is unchanged
      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            defaultCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(12345);

      // Check that non-default community score is now set
      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            testCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(67890);

      // Check that community attestation UIDs are being stored correctly
      const communityAttestationUID =
        await gitcoinResolver.communityScoreAttestations(
          testCommunityId,
          recipient.address
        );
      expect(communityAttestationUID).to.equal(communityAttestation.uid);
    });

    it("should revoke default and custom community scoreV2 correctly", async function () {
      const defaultStamps: Stamp[] = [
        { provider: "Github", score: 100000 },
        { provider: "Twitter", score: 150000 }
      ];

      const communityStamps: Stamp[] = [
        { provider: "Github", score: 200000 },
        { provider: "Twitter", score: 250000 }
      ];

      // Create and attest default community score
      const defaultAttestation = getScoreV2Attestation(
        {
          schema: scoreV2SchemaId,
          recipient: recipient.address,
          attester: await gitcoinAttester.getAddress()
        },
        {
          passing_score: true,
          score_decimals: 4,
          scorer_id: defaultCommunityId,
          score: 12345,
          threshold: 10000,
          stamps: defaultStamps
        }
      );

      await gitcoinResolver.connect(mockEas).attest(defaultAttestation);

      // Create and attest community-specific score
      const communityAttestation = getScoreV2Attestation(
        {
          schema: scoreV2SchemaId,
          recipient: recipient.address,
          attester: await gitcoinAttester.getAddress()
        },
        {
          passing_score: true,
          score_decimals: 4,
          scorer_id: testCommunityId,
          score: 67890,
          threshold: 10000,
          stamps: communityStamps
        }
      );

      await gitcoinResolver.connect(mockEas).attest(communityAttestation);

      // Verify scores are set before revocation
      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            defaultCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(12345);

      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            testCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(67890);

      // Revoke default community score
      await gitcoinResolver.connect(mockEas).revoke(defaultAttestation);

      // Verify default score is cleared, community score remains
      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            defaultCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(0);

      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            testCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(67890);

      // Verify attestation UID is cleared
      expect(
        await gitcoinResolver.userAttestations(
          recipient.address,
          scoreV2SchemaId
        )
      ).to.equal(ethers.ZeroHash);

      // Revoke community score
      await gitcoinResolver.connect(mockEas).revoke(communityAttestation);

      // Verify both scores are now cleared
      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            defaultCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(0);

      expect(
        (
          await gitcoinResolver["getCachedScore(uint32,address)"](
            testCommunityId,
            recipient.address
          )
        )[0]
      ).to.equal(0);

      // Verify community attestation UID is cleared
      expect(
        await gitcoinResolver.communityScoreAttestations(
          testCommunityId,
          recipient.address
        )
      ).to.equal(ethers.ZeroHash);
    });
  });

  describe("Multi-Attest and Multi-Revoke with ScoreV2", function () {
    it("should properly handle multiple scoreV2 attestations", async function () {
      const recipients = [
        { address: recipient.address, score: 12345 },
        {
          address: (await ethers.getSigners())[10].address,
          score: 67890
        }
      ];

      const attestations = [];

      for (const rec of recipients) {
        const stamps: Stamp[] = [
          { provider: "Github", score: 100000 },
          { provider: "Twitter", score: 150000 }
        ];

        attestations.push(
          getScoreV2Attestation(
            {
              schema: scoreV2SchemaId,
              recipient: rec.address,
              attester: await gitcoinAttester.getAddress(),
              time: 200500,
              expirationTime: 700500
            },
            {
              passing_score: true,
              score_decimals: 4,
              scorer_id: 1,
              score: rec.score,
              threshold: 10000,
              stamps
            }
          )
        );
      }

      // Attest multiple in one transaction
      await gitcoinResolver.connect(mockEas).multiAttest(attestations, []);

      // Verify scores were set correctly
      for (let i = 0; i < recipients.length; i++) {
        const score = await gitcoinResolver.getCachedScore(
          recipients[i].address
        );
        expect(score[0]).to.equal(recipients[i].score);
      }

      // Revoke multiple in one transaction
      await gitcoinResolver.connect(mockEas).multiRevoke(attestations, []);

      // Verify scores were cleared
      for (let i = 0; i < recipients.length; i++) {
        const score = await gitcoinResolver.getCachedScore(
          recipients[i].address
        );
        expect(score[0]).to.equal(0);
      }
    });
  });

  describe("Mixed Schema Usage", function () {
    let scoreSchemaId: string;

    before(async function () {
      // Register regular score schema
      scoreSchemaId = ethers.keccak256(
        ethers.toUtf8Bytes("regularScoreSchema")
      );
      await gitcoinResolver.connect(owner).setScoreSchema(scoreSchemaId);
    });

    it("should handle both regular score and scoreV2 schemas correctly", async function () {
      // Create and attest regular score
      const regularAttestation = getScoreAttestation(
        {
          schema: scoreSchemaId,
          recipient: recipient.address,
          attester: await gitcoinAttester.getAddress(),
          time: 100000,
          expirationTime: 500000
        },
        {
          score: "54321",
          scorer_id: 1,
          score_decimals: 4
        }
      ) as AttestationStruct;

      await gitcoinResolver.connect(mockEas).attest(regularAttestation);

      // Check regular score
      let score = await gitcoinResolver.getCachedScore(recipient.address);
      expect(score[0]).to.equal(54321);

      // Create and attest scoreV2
      const stamps: Stamp[] = [
        { provider: "Github", score: 100000 },
        { provider: "Twitter", score: 150000 }
      ];

      const v2Attestation = getScoreV2Attestation(
        {
          schema: scoreV2SchemaId,
          recipient: recipient.address,
          attester: await gitcoinAttester.getAddress(),
          time: 200500,
          expirationTime: 700500
        },
        {
          passing_score: true,
          score_decimals: 4,
          scorer_id: 1,
          score: 98765,
          threshold: 10000,
          stamps
        }
      );

      await gitcoinResolver.connect(mockEas).attest(v2Attestation);

      // Check that scoreV2 overrides the regular score
      score = await gitcoinResolver.getCachedScore(recipient.address);
      expect(score[0]).to.equal(98765);

      // Revoke scoreV2
      await gitcoinResolver.connect(mockEas).revoke(v2Attestation);

      // Score should be back to 0 after revocation
      score = await gitcoinResolver.getCachedScore(recipient.address);
      expect(score[0]).to.equal(0);
    });
  });
});
