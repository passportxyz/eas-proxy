// This script deals with deploying the GitcoinAttester on a given network
import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  transferOwnershipToMultisig,
  getAttesterAddress,
  getVerifierAddress,
  getResolverAddress,
  getPassportDecoderAddress,
  getScoreSchema
} from "./lib/utils";

assertEnvironment();

if (!process.env.PASSPORT_MULTISIG_ADDRESS) {
  console.error("Please set your PASSPORT_MULTISIG_ADDRESS in a .env file");
}

let userAddress = process.env.ETH_ADDRESS_TO_CHECK
  ? process.env.ETH_ADDRESS_TO_CHECK
  : "0x0";
if (!process.env.ETH_ADDRESS_TO_CHECK) {
  console.error("Please set your ETH_ADDRESS_TO_CHECK for calling this script");
}

export async function main() {
  const GitcoinResolver = await ethers.getContractFactory("GitcoinResolver");
  const resolver = GitcoinResolver.attach(getResolverAddress());

  console.log("\nCheck recipient with ETH address: ", userAddress);
  console.log("\n");
  console.log("\nGitcoinResolver");
  console.log("   _gitcoinAttester: ", await resolver._gitcoinAttester());
  console.log("   _eas: ", await resolver._eas());
  console.log(
    "   getCachedScore: ",
    await resolver.getCachedScore(userAddress)
  );
  const attestationUID = await resolver.getUserAttestation(
    userAddress,
    getScoreSchema()
  );
  console.log("   getUserAttestation: ", attestationUID);

  // console.log("   scoreSchema: ", await resolver.scoreSchema());

  const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
  const verifier = GitcoinVerifier.attach(getVerifierAddress());
  console.log("\nGitcoinVerifier");
  console.log("   attester: ", await verifier.attester());
  console.log("   issuer: ", await verifier.issuer());

  const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
  const attester = GitcoinAttester.attach(getAttesterAddress());
  console.log("\nGitcoinAttester");
  // console.log("   eas: ", await attester.eas());

  const GitcoinPassportDecoder = await ethers.getContractFactory(
    "GitcoinPassportDecoder"
  );
  const decoder = GitcoinPassportDecoder.attach(getPassportDecoderAddress());
  console.log("\nGitcoinPassportDecoder");
  console.log("   eas: ", await decoder.eas());
  console.log("   currentVersion: ", await decoder.currentVersion());
  console.log("   epassportSchemaUIDas: ", await decoder.passportSchemaUID());
  console.log("   scoreSchemaUID: ", await decoder.scoreSchemaUID());
  console.log("   maxScoreAge: ", await decoder.maxScoreAge());
  console.log("   threshold: ", await decoder.threshold());
  console.log(
    "   getAttestation: \n------------------\n",
    await decoder.getAttestation(attestationUID),
    "\n------------------"
  );
  console.log("   getScore: ", await decoder.getScore(userAddress));

  // const GitcoinPassportDecoder = await ethers.getContractFactory("GitcoinPassportDecoder");
  // const passportDecoder = GitcoinPassportDecoder.attach(getPassportDecoderAddress());

  // await transferOwnershipToMultisig(resolver);
  // await transferOwnershipToMultisig(verifier);
  // await transferOwnershipToMultisig(attester);
  // await transferOwnershipToMultisig(passportDecoder);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
