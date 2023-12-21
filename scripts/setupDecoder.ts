import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getResolverAddress,
  getPassportDecoderAddress,
  getEASAddress,
  getThisChainInfo
} from "./lib/utils";
import { getSchemaUID } from "@ethereum-attestation-service/eas-sdk";
import providerBitMapInfo from "./data/providerBitMapInfo.json";
import newBitMap from "../deployments/providerBitMapInfo.json";

assertEnvironment();

export async function main() {
  const chainInfo = getThisChainInfo();
  const maxScoreAge = 90 * 24 * 3600; // 90 days
  const threshold = 200000; // that means 20.0000

  await confirmContinue({
    contract: "Add schema and bitmap information to GitcoinPassportDecoder",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    maxScoreAge: maxScoreAge,
    threshold: threshold
  });

  const GitcoinPassportDecoder = await ethers.getContractFactory(
    "GitcoinPassportDecoder"
  );
  const passportDecoder = GitcoinPassportDecoder.attach(
    getPassportDecoderAddress()
  );

  const easAddress = getEASAddress();

  const currentEas = await passportDecoder.eas();
  console.log("== currentEas", currentEas);
  // await passportDecoder.setEASAddress(easAddress);
  // console.log(`✅ Set EAS address ${easAddress} on GitcoinPassportDecoder.`);

  const currentGitcoinResolver = await passportDecoder.gitcoinResolver();
  const currentPassportSchemaUID = await passportDecoder.passportSchemaUID();
  const currentScoreSchemaUID = await passportDecoder.scoreSchemaUID();
  const currentMaxScoreAge = await passportDecoder.maxScoreAge();
  const currentThreshold = await passportDecoder.threshold();

  console.log("== currentGitcoinResolver", currentGitcoinResolver);
  console.log("== currentPassportSchemaUID", currentPassportSchemaUID);
  console.log("== currentScoreSchemaUID", currentScoreSchemaUID);
  console.log("== currentMaxScoreAge", currentMaxScoreAge);
  console.log("== currentThreshold", currentThreshold);

  if (currentGitcoinResolver != getResolverAddress()) {
    const currentGitcoinResolver = await passportDecoder.gitcoinResolver();
    console.log("== gitcoinResolver", gitcoinResolver);
    await passportDecoder.setGitcoinResolver(getResolverAddress());
    console.log(
      `✅ Set GitcoinResolver address ${getResolverAddress()} on GitcoinPassportDecoder.`
    );
  } else {
    console.log(
      `-> skipp setting GitcoinResolver address ${getResolverAddress()} on GitcoinPassportDecoder.`
    );
  }

  if (currentGitcoinResolver != getResolverAddress()) {
    await passportDecoder.setPassportSchemaUID(
      chainInfo.easSchemas.passport.uid
    );
    console.log(
      `✅ Set Passport SchemaUID to ${chainInfo.easSchemas.passport.uid} on GitcoinPassportDecoder.`
    );
  } else {
    console.log(
      `-> skip setiing Passport SchemaUID to ${chainInfo.easSchemas.passport.uid} on GitcoinPassportDecoder.`
    );
  }

  if (currentScoreSchemaUID != chainInfo.easSchemas.score.uid) {
    await passportDecoder.setScoreSchemaUID(chainInfo.easSchemas.score.uid);
    console.log(
      `✅ Set Passport SchemaUID to ${chainInfo.easSchemas.score.uid} on GitcoinPassportDecoder.`
    );
  } else {
    console.log(
      `-> skip setting Passport SchemaUID to ${chainInfo.easSchemas.score.uid} on GitcoinPassportDecoder.`
    );
  }

  const currentMaxScoreAge = await passportDecoder.maxScoreAge();
  console.log("== maxScoreAge", maxScoreAge);
  // await passportDecoder.setMaxScoreAge(maxScoreAge);
  // console.log(
  //   `✅ Set maxScoreAge to ${maxScoreAge} on GitcoinPassportDecoder.`
  // );

  const currentThreshold = await passportDecoder.threshold();
  console.log("== threshold", threshold);
  // await passportDecoder.setThreshold(threshold);
  // console.log(`✅ Set threshold to ${threshold} on GitcoinPassportDecoder.`);

  // We do this considering we have only index = 0 in the providerBitMapInfo
  const currentVersion = await passportDecoder.currentVersion();
  console.log("currentVersion", currentVersion);
  // const currentProviders = await passportDecoder.providerVersions(
  //   currentVersion, 0
  // );
  // console.log("currentProviders", currentProviders);

  const providers = new Array(256).fill("");
  let maxProviderIndex = 0;
  console.log(`🚀 Adding providers...`);
  providerBitMapInfo.forEach(async (provider) => {
    console.log("   adding provider", provider);
    providers[provider.bit] = provider.name;
    if (provider.bit > maxProviderIndex) {
      maxProviderIndex = provider.bit;
    }
  });

  // Drop the empty elemnts at the end

  ///////////////////////////

  // providers.splice(maxProviderIndex + 1);
  // console.log("   providers: ", providers);
  // console.log(`🚀    writing providers to blockchain...`);
  // const tx = await passportDecoder.addProviders(providers);
  // const receipt = await tx.wait();

  ///////////////////////////

  console.log(`✅ Added providers to GitcoinPassportDecoder.`);
}

main();
