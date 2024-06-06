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
import providerBitMapInfo from "../deployments/providerBitMapInfo.json";

assertEnvironment();

export async function main() {
  const chainInfo = getThisChainInfo();
  const maxScoreAge = ethers.toBigInt(90 * 24 * 3600); // 90 days
  const threshold = ethers.toBigInt(200000); // that means 20.0000

  const GitcoinPassportDecoder = await ethers.getContractFactory(
    "GitcoinPassportDecoder"
  );
  const passportDecoder = GitcoinPassportDecoder.attach(
    getPassportDecoderAddress()
  );

  const easAddress = getEASAddress();

  const currentEas = await passportDecoder.eas();

  const currentGitcoinResolver = await passportDecoder.gitcoinResolver();
  const currentPassportSchemaUID = await passportDecoder.passportSchemaUID();
  const currentScoreSchemaUID = await passportDecoder.scoreSchemaUID();
  const currentMaxScoreAge = await passportDecoder.maxScoreAge();
  const currentThreshold = await passportDecoder.threshold();

  console.log("== currentEas", currentEas, "/", easAddress);
  console.log(
    "== currentGitcoinResolver",
    currentGitcoinResolver,
    "/",
    getResolverAddress()
  );
  console.log(
    "== currentPassportSchemaUID",
    currentPassportSchemaUID,
    "/",
    chainInfo.easSchemas.passport.uid
  );
  console.log(
    "== currentScoreSchemaUID",
    currentScoreSchemaUID,
    "/",
    chainInfo.easSchemas.score.uid
  );
  console.log("== currentMaxScoreAge", currentMaxScoreAge, "/", maxScoreAge);
  console.log("== currentThreshold", currentThreshold, "/", threshold);

  const providers = new Array(256).fill("");
  let maxProviderIndex = 0;
  console.log(`🚀 Adding providers...`);
  providerBitMapInfo.forEach(async (provider) => {
    providers[provider.bit] = provider.name;
    if (provider.bit > maxProviderIndex) {
      maxProviderIndex = provider.bit;
    }
  });

  // Drop the empty elemnts at the end
  providers.splice(maxProviderIndex + 1);
  console.log(`🚀 providers to be added: `, providers);

  // We do this considering we have only index = 0 in the providerBitMapInfo
  const currentVersion = await passportDecoder.currentVersion();
  console.log("currentVersion", currentVersion);

  await confirmContinue({
    contract: "Add schema and bitmap information to GitcoinPassportDecoder",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    maxScoreAge: maxScoreAge,
    threshold: threshold,
    resolverAddress: getResolverAddress(),
    easAddress: easAddress,
    passportSchemaUUID: chainInfo.easSchemas.passport.uid,
    scoreSchemaUUID: chainInfo.easSchemas.score.uid,
    bitmapVersion: currentVersion
  });

  if (currentEas != easAddress) {
    await passportDecoder.setEASAddress(easAddress);
    console.log(`✅ Set EAS address ${easAddress} on GitcoinPassportDecoder.`);
  } else {
    console.log(
      `-> skip setting EAS address ${easAddress} on GitcoinPassportDecoder.`
    );
  }

  if (currentGitcoinResolver != getResolverAddress()) {
    await passportDecoder.setGitcoinResolver(getResolverAddress());
    console.log(
      `✅ Set GitcoinResolver address ${getResolverAddress()} on GitcoinPassportDecoder.`
    );
  } else {
    console.log(
      `-> skip setting GitcoinResolver address ${getResolverAddress()} on GitcoinPassportDecoder.`
    );
  }

  if (currentPassportSchemaUID != chainInfo.easSchemas.passport.uid) {
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

  if (currentMaxScoreAge != maxScoreAge) {
    await passportDecoder.setMaxScoreAge(maxScoreAge);
    console.log(
      `✅ Set maxScoreAge to ${maxScoreAge} on GitcoinPassportDecoder.`
    );
  } else {
    console.log(
      `-> skip setting maxScoreAge to ${maxScoreAge} on GitcoinPassportDecoder.`
    );
  }

  if (currentThreshold != threshold) {
    await passportDecoder.setThreshold(threshold);
    console.log(`✅ Set threshold to ${threshold} on GitcoinPassportDecoder.`);
  } else {
    console.log(
      `-> skip set threshold to ${threshold} on GitcoinPassportDecoder.`
    );
  }

  console.log("   providers: ", providers);
  console.log(`🚀    writing providers to blockchain...`);
  const tx = await passportDecoder.addProviders(providers);
  const receipt = await tx.wait();

  console.log(`✅ Added providers to GitcoinPassportDecoder.`);
}

main();
