import { expect, version } from "chai";
import { ethers } from "hardhat";
import {
  ZERO_BYTES32,
  NO_EXPIRATION,
} from "@ethereum-attestation-service/eas-sdk";
import {
  GitcoinAttester,
  GitcoinResolver,
  GitcoinPassportDecoder,
} from "../typechain-types";
import { encodedData } from "./helpers/mockAttestations";
import { SCHEMA_REGISTRY_ABI } from "./abi/SCHEMA_REGISTRY_ABI";
import { schemaRegistryContractAddress } from "./GitcoinResolver";

describe("GitcoinPassportDecoder", async () => {
  let owner: any,
    iamAccount: any,
    recipient: any,
    nonOwnerOrVerifier: any,
    mockEas: any,
    gitcoinResolver: GitcoinResolver,
    gitcoinAttester: GitcoinAttester,
    gitcoinPassportDecoder: GitcoinPassportDecoder;

  beforeEach(async function () {
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

    const schemaRegistry = new ethers.Contract(
      schemaRegistryContractAddress,
      SCHEMA_REGISTRY_ABI,
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

    const GitcoinPassportDecoder = await ethers.getContractFactory(
      "GitcoinPassportDecoder",
      owner,
    );

    gitcoinPassportDecoder = await GitcoinPassportDecoder.deploy();

    await gitcoinPassportDecoder
      .connect(owner)
      .initialize(gitcoinResolverAddress);
  });

  describe("Creating new versions", function () {
    it.only("should add new providers to the providers mapping and increment the version", async function () {
      const providers = ["NewStamp1", "NewStamp2"];

      // Get the 0th version
      const versionZero = await gitcoinPassportDecoder.version();

      expect(versionZero === 0);

      await gitcoinPassportDecoder.connect(owner).createNewVersion(providers);

      // Get the current version
      const currentVersion = await gitcoinPassportDecoder.version();

      expect(currentVersion === 1);

      const firstProvider = await gitcoinPassportDecoder.providers(currentVersion, 0);

      expect(firstProvider === providers[0]);
    });

    // Should not allow anyone other than owner to add new providers to the mapping
  });

  describe("Adding new providers to current version of providers", async function () {

  });

  describe("", async function () {

  });
});