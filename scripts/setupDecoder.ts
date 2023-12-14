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

  await passportDecoder.setEASAddress(easAddress);
  console.log(`✅ Set EAS address ${easAddress} on GitcoinPassportDecoder.`);

  await passportDecoder.setGitcoinResolver(getResolverAddress());
  console.log(
    `✅ Set GitcoinResolver address ${getResolverAddress()} on GitcoinPassportDecoder.`
  );

  await passportDecoder.setPassportSchemaUID(chainInfo.easSchemas.passport.uid);
  console.log(
    `✅ Set Passport SchemaUID to ${chainInfo.easSchemas.passport.uid} on GitcoinPassportDecoder.`
  );

  await passportDecoder.setScoreSchemaUID(chainInfo.easSchemas.score.uid);
  console.log(
    `✅ Set Passport SchemaUID to ${chainInfo.easSchemas.score.uid} on GitcoinPassportDecoder.`
  );

  await passportDecoder.setMaxScoreAge(maxScoreAge);
  console.log(
    `✅ Set maxScoreAge to ${maxScoreAge} on GitcoinPassportDecoder.`
  );

  await passportDecoder.setThreshold(threshold);
  console.log(`✅ Set threshold to ${threshold} on GitcoinPassportDecoder.`);

  // const providers = newBitMap.map((bit) => bit.name);
  // await passportDecoder.addProviders(providers);

  console.log(`✅ Added providers to GitcoinPassportDecoder.`);
}

main();
