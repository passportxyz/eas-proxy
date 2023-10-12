import { expect } from "chai";
import { ethers } from "hardhat";
import {
  SchemaEncoder,
  ZERO_BYTES32,
  NO_EXPIRATION,
  EAS,
} from "@ethereum-attestation-service/eas-sdk";
import {
  GitcoinAttester,
  GitcoinResolver,
  GitcoinPassportDecoder,
} from "../typechain-types";
import { SCHEMA_REGISTRY_ABI } from "./abi/SCHEMA_REGISTRY_ABI";
import { schemaRegistryContractAddress } from "./GitcoinResolver";
import {
  passportTypes,
  fee1,
  EAS_CONTRACT_ADDRESS,
} from "./GitcoinVerifier";
import { BytesLike } from "ethers";

type Provider = {
  // TODO: add provider type
}

type Hash = {
  hash: BytesLike;
}

type IssuanceDate = {
  issuanceDate: number;
}

type ExpirationDate = {
  expirationDate: number;
}

type PassportAttestation = {
  providers: Provider[];
  hashes: Hash[];
  issuanceDates: IssuanceDate[];
  expirationDates: ExpirationDate[];
}

// const providers = ["Twitter", "Google", "Ens"];
const providers = [BigInt("9444733296762888765505")];
const issuanceDates = [1694628559, 1695047108, 1693498086];
const expirationDates = [1702404559, 1702823108, 1701274086];
const hashes = [
  "0xf760285ed09eb7bb0da39df5abd0adb608d410b357ab6415644d2b49aa64e5f1", "0x29b3eb7b8ee47cb0a9d83e7888f05ea5f61e3437752602282e18129d2d8b4024", "0x84c6f60094c95180e54fac3e9a5cfde8ca430e598e987504474151a219ae0d13",
];
const providerMapVersion = 1;

const easEncodeStamp = () => {
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
}

describe("GitcoinPassportDecoder", async function () {
  this.beforeAll(async function () {
    const [ownerAccount, iamAcct, recipientAccount] =
      await ethers.getSigners();

    this.owner = ownerAccount;
    this.iamAccount = iamAcct;
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

    this.stampSchemaInput = "uint256[] providers, bytes32[] hashes, uint64[] issuanceDates, uint64[] expirationDates, uint16 providerMapVersion";
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

    this.passport = {
      multiAttestationRequest: [
        {
          schema: this.passportSchemaUID,
          data: [
          //   {
          //     recipient: this.recipient.address,
          //     expirationTime: 1708741995,
          //     revocable: true,
          //     refUID: ZERO_BYTES32,
          //     data: easEncodeStamp(),
          //     value: 0,
          //   },
            {
              recipient: this.recipient.address,
              expirationTime: 1708741995,
              revocable: true,
              refUID: ZERO_BYTES32,
              data: easEncodeStamp(),
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
      this.owner,
    );

    this.gitcoinPassportDecoder = await GitcoinPassportDecoder.deploy();

    await this.gitcoinPassportDecoder
      .connect(this.owner)
      .initialize(this.resolverAddress);

    // Initialize the sdk with the address of the EAS Schema contract address
    await this.gitcoinPassportDecoder.setEASAddress(EAS_CONTRACT_ADDRESS);
  });
  
  this.beforeEach(async function () {
    this.passport.nonce = await this.gitcoinVerifier.recipientNonces(
      this.passport.multiAttestationRequest[0].data[0].recipient
    );
  });

  describe("Creating new versions", function () {
    it("should add new providers to the providers mapping and increment the version", async function () {
      const providers = ["NewStamp1", "NewStamp2"];
      // Get the 0th version
      const versionZero = await this.gitcoinPassportDecoder.version();

      expect(versionZero === 0);

      await this.gitcoinPassportDecoder.connect(this.owner).createNewVersion(providers);

      // Get the current version
      const currentVersion = await this.gitcoinPassportDecoder.version();

      expect(currentVersion === 1);

      const firstProvider = await this.gitcoinPassportDecoder.providerVersions(currentVersion, 0);
      
      expect(firstProvider === providers[0]);
    });

    // Should not allow anyone other than owner to add new providers to the mapping
  });

  describe("Adding new providers to current version of providers", async function () {

  });

  describe("Decoding Passports", async function () {
    it.only("should decode a user's passport", async function () {
      const signature = await this.iamAccount.signTypedData(
        this.domain,
        passportTypes,
        this.passport
      );

      const { v, r, s } = ethers.Signature.from(signature);

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
        .getPassport(this.recipient.address, this.passportSchemaUID);

      const receipt = await passportTx.wait();

      console.log(receipt.logs);
      

      // const passportEvents = await this.gitcoinPassportDecoder.queryFilter(this.gitcoinPassportDecoder.filters.PassportDecoded(), passportTx.blockNumber);
      // console.log("Events -=-=-=-=>", passportEvents.queryFilter());
      
    });
  });
});