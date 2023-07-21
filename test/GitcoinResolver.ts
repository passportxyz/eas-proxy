import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EAS,
  SchemaEncoder,
  ZERO_BYTES32,
  NO_EXPIRATION,
} from "@ethereum-attestation-service/eas-sdk";
import { GitcoinAttester, GitcoinResolver } from "../typechain-types";
import { ethers as Ethers } from "ethers";

type Stamp = {
  provider: string;
  stampHash: string;
};

const GITCOIN_VCS_SCHEMA =
  "0x853a55f39e2d1bf1e6731ae7148976fbbb0c188a898a233dba61a233d8c0e4a4";
const schemaRegistryContractAddress =
  process.env.SEPOLIA_SCHEMA_REGISTRY_ADDRESS ||
  "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";
// const schemaRegistry = new SchemaRegistry(schemaRegistryContractAddress);
const schemaRegistryAbi = [
  {
    inputs: [],
    name: "AlreadyExists",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "uid",
        type: "bytes32",
      },
      {
        indexed: false,
        internalType: "address",
        name: "registerer",
        type: "address",
      },
    ],
    name: "Registered",
    type: "event",
  },
  {
    inputs: [],
    name: "VERSION",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "uid",
        type: "bytes32",
      },
    ],
    name: "getSchema",
    outputs: [
      {
        components: [
          {
            internalType: "bytes32",
            name: "uid",
            type: "bytes32",
          },
          {
            internalType: "contract ISchemaResolver",
            name: "resolver",
            type: "address",
          },
          {
            internalType: "bool",
            name: "revocable",
            type: "bool",
          },
          {
            internalType: "string",
            name: "schema",
            type: "string",
          },
        ],
        internalType: "struct SchemaRecord",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "schema",
        type: "string",
      },
      {
        internalType: "contract ISchemaResolver",
        name: "resolver",
        type: "address",
      },
      {
        internalType: "bool",
        name: "revocable",
        type: "bool",
      },
    ],
    name: "register",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export const easEncodeStamp = (stamp: Stamp) => {
  const schemaEncoder = new SchemaEncoder("bytes32 provider, bytes32 hash");
  let providerValue = ethers.keccak256(ethers.toUtf8Bytes(stamp.provider));

  const encodedData = schemaEncoder.encodeData([
    { name: "provider", value: providerValue, type: "bytes32" },
    { name: "hash", value: providerValue, type: "bytes32" }, // TODO decode hash here
  ]);
  return encodedData;
};

const network = process.env.ETHEREUM_NETWORK || "sepolia";

const encodedData = easEncodeStamp({
  provider: "TestProvider",
  stampHash: "234567890",
});

describe("GitcoinResolver", function () {
  let owner: any,
    iamAccount: any,
    recipient: any,
    nonOwnerOrVerifier: any,
    mockEas: any,
    gitcoinResolver: GitcoinResolver,
    gitcoinAttester: GitcoinAttester;

  before(async function () {
    const [
      ownerAccount,
      otherAccount,
      recipientAccount,
      mockEasContractAccount,
      nonOwnerOrVerifierAccount,
    ] = await ethers.getSigners();

    owner = ownerAccount;
    iamAccount = otherAccount;
    recipient = recipientAccount;
    mockEas = mockEasContractAccount;
    nonOwnerOrVerifier = nonOwnerOrVerifierAccount;

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

    this.uid = ethers.keccak256(ethers.toUtf8Bytes("test"));

    this.validAttestation = {
      uid: this.uid,
      schema: GITCOIN_VCS_SCHEMA,
      time: NO_EXPIRATION,
      expirationTime: NO_EXPIRATION,
      revocationTime: NO_EXPIRATION,
      refUID: ZERO_BYTES32,
      recipient: recipient.address,
      attester: gitcoinAttesterAddress,
      revocable: true,
      data: encodedData,
    };

    const schemaRegistry = new ethers.Contract(
      schemaRegistryContractAddress,
      schemaRegistryAbi,
      owner
    );

    const schema = "uint256 eventId, uint8 voteIndex";
    const resolverAddress = gitcoinResolverAddress;
    const revocable = true;

    const transaction = await schemaRegistry.register(
      schema,
      resolverAddress,
      revocable
    );

    await transaction.wait();
  });

  describe("Attestations", function () {
    it("should make 1 attestation", async function () {
      await expect(
        gitcoinResolver.connect(mockEas).attest(this.validAttestation)
      )
        .to.emit(gitcoinResolver, "PassportAdded")
        .withArgs(this.validAttestation.recipient, this.uid);

      const attestationUID = await gitcoinResolver.passports(recipient.address);

      expect(attestationUID).to.equal(this.uid);
    });

    it("should make multiple attestations", async function () {
      await expect(gitcoinResolver
        .connect(mockEas)
        .multiAttest(
          [this.validAttestation, this.validAttestation, this.validAttestation],
          []
        ))
          .to.emit(gitcoinResolver, "PassportAdded");

      const attestationUID = await gitcoinResolver.passports(recipient.address);

      expect(attestationUID).to.equal(this.uid);
    });

    it("should revert when a non-allowed address attempts to make any attestation", async function () {
      await expect(
        gitcoinResolver.connect(iamAccount).attest(this.validAttestation)
      ).to.be.revertedWith("Only EAS contract can call this function");
    });

    it("should revert if an address other than the Gitcoin attester attempts to make an attestation", async function () {
      const uid = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const attestation = {
        uid,
        schema: GITCOIN_VCS_SCHEMA,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester: nonOwnerOrVerifier.address,
        revocable: true,
        data: encodedData,
      };

      await expect(
        gitcoinResolver.connect(mockEas).attest(attestation)
      ).to.be.revertedWith("Only the Gitcoin Attester can make attestations");
    });
  });

  describe("Revocations", function () {
    it("should make 1 revocation", async function () {
      // Make an attestation
      await gitcoinResolver.connect(mockEas).attest(this.validAttestation);
      await expect(gitcoinResolver
        .connect(mockEas)
        .revoke(this.validAttestation))
        .to.emit(gitcoinResolver, "PassportRemoved")
        .withArgs(this.validAttestation.recipient, this.uid);
    });

    it("Should make multiple revocations", async function () {
      await gitcoinResolver
        .connect(mockEas)
        .multiAttest(
          [this.validAttestation, this.validAttestation, this.validAttestation], []
        );
      await expect(gitcoinResolver
        .connect(mockEas)
        .multiRevoke(
          [this.validAttestation, this.validAttestation, this.validAttestation],
          []
        )).to.emit(gitcoinResolver, "PassportRemoved");

      let attestationUID = await gitcoinResolver.passports(recipient.address);
      expect(attestationUID).to.equal(ethers.ZeroHash);
    });

    it("should allow a user to revoke their own attestation", async function () {
      const validAttestation = {
        uid: this.uid,
        schema: GITCOIN_VCS_SCHEMA,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester: recipient,
        revocable: true,
        data: encodedData,
      };
      // Make an attestations
      await gitcoinResolver.connect(mockEas).attest(this.validAttestation);
      // Get the result of the revocation made by the user
      await expect(gitcoinResolver
        .connect(recipient)
        .revoke(validAttestation))
        .to.emit(gitcoinResolver, "PassportRemoved")
        .withArgs(validAttestation.recipient, this.uid);

        let attestationUID = await gitcoinResolver.passports(recipient.address);
        expect(attestationUID).to.equal(ethers.ZeroHash);
    });

    it("should allow a user to revoke their own attestations", async function () {
      const validAttestation = {
        uid: this.uid,
        schema: GITCOIN_VCS_SCHEMA,
        time: NO_EXPIRATION,
        expirationTime: NO_EXPIRATION,
        revocationTime: NO_EXPIRATION,
        refUID: ZERO_BYTES32,
        recipient: recipient.address,
        attester: recipient,
        revocable: true,
        data: encodedData,
      };
      // Make an attestations
      await gitcoinResolver
        .connect(mockEas)
        .multiAttest(
          [this.validAttestation, this.validAttestation, this.validAttestation], []
        );
      // Get the result of the revocation made by the user
      await expect(gitcoinResolver
        .connect(recipient)
        .multiRevoke([validAttestation, validAttestation, validAttestation], []))
        .to.emit(gitcoinResolver, "PassportRemoved");

        let attestationUID = await gitcoinResolver.passports(recipient.address);
        expect(attestationUID).to.equal(ethers.ZeroHash);
    });
  });

  describe("Pausability", function () {
    it("should pause and unpause", async function () {
      await gitcoinResolver.pause();
      expect(await gitcoinResolver.paused()).to.equal(true);
      await gitcoinResolver.unpause();
      expect(await gitcoinResolver.paused()).to.equal(false);
    });

    it("should revert when paused", async function () {
      await gitcoinResolver.pause();
      await expect(
        gitcoinResolver.attest(this.validAttestation)
      ).to.be.revertedWith("Pausable: paused");
      await gitcoinResolver.unpause();
    });
    
    it("should not allow non owner to pause", async function () {
      await expect(
        gitcoinResolver.connect(nonOwnerOrVerifier).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
