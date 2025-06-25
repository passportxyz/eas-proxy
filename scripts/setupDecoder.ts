import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getResolverAddress,
  getPassportDecoderAddress,
  getEASAddress,
  getThisChainInfo
} from "./lib/utils";

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
  const currentScoreV2SchemaUID = await passportDecoder.scoreV2SchemaUID();
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
    "== currentScoreV2SchemaUID",
    currentScoreV2SchemaUID,
    "/",
    chainInfo.easSchemas.scoreV2.uid
  );
  console.log("== currentMaxScoreAge", currentMaxScoreAge, "/", maxScoreAge);
  console.log("== currentThreshold", currentThreshold, "/", threshold);

  await confirmContinue({
    contract: "Add schema and bitmap information to GitcoinPassportDecoder",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    maxScoreAge: maxScoreAge,
    threshold: threshold,
    resolverAddress: getResolverAddress(),
    easAddress: easAddress,
    scoreV2SchemaUUID: chainInfo.easSchemas.scoreV2.uid
  });

  if (currentEas != easAddress) {
    const setEASTx = await passportDecoder.setEASAddress(easAddress);
    await setEASTx.wait();
    console.log(`✅ Set EAS address ${easAddress} on GitcoinPassportDecoder.`);
  } else {
    console.log(
      `-> skip setting EAS address ${easAddress} on GitcoinPassportDecoder.`
    );
  }

  if (currentGitcoinResolver != getResolverAddress()) {
    const setResolverTx = await passportDecoder.setGitcoinResolver(
      getResolverAddress()
    );
    await setResolverTx.wait();
    console.log(
      `✅ Set GitcoinResolver address ${getResolverAddress()} on GitcoinPassportDecoder.`
    );
  } else {
    console.log(
      `-> skip setting GitcoinResolver address ${getResolverAddress()} on GitcoinPassportDecoder.`
    );
  }

  if (currentScoreV2SchemaUID != chainInfo.easSchemas.scoreV2.uid) {
    const setScoreV2SchemaTx = await passportDecoder.setScoreV2SchemaUID(
      chainInfo.easSchemas.scoreV2.uid
    );
    await setScoreV2SchemaTx.wait();
    console.log(
      `✅ Set ScoreV2 SchemaUID to ${chainInfo.easSchemas.scoreV2.uid} on GitcoinPassportDecoder.`
    );
  } else {
    console.log(
      `-> skip setting ScoreV2 SchemaUID to ${chainInfo.easSchemas.scoreV2.uid} on GitcoinPassportDecoder.`
    );
  }

  if (currentMaxScoreAge != maxScoreAge) {
    const setMaxScoreAgeTx = await passportDecoder.setMaxScoreAge(maxScoreAge);
    await setMaxScoreAgeTx.wait();
    console.log(
      `✅ Set maxScoreAge to ${maxScoreAge} on GitcoinPassportDecoder.`
    );
  } else {
    console.log(
      `-> skip setting maxScoreAge to ${maxScoreAge} on GitcoinPassportDecoder.`
    );
  }

  if (currentThreshold != threshold) {
    const setThresholdTx = await passportDecoder.setThreshold(threshold);
    await setThresholdTx.wait();
    console.log(`✅ Set threshold to ${threshold} on GitcoinPassportDecoder.`);
  } else {
    console.log(
      `-> skip set threshold to ${threshold} on GitcoinPassportDecoder.`
    );
  }
}

main();
