import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getDecoderAddress
} from "./lib/utils";
import providerBitMapInfo from "../deployments/providerBitMapInfo.json";

assertEnvironment();

export async function main() {
  const decoderAddress = getDecoderAddress();
  const GitcoinDecoder = await ethers.getContractFactory(
    "GitcoinPassportDecoder"
  );
  const gitcoinDecoder = GitcoinDecoder.attach(decoderAddress);

  const currentVersion = await gitcoinDecoder.currentVersion();
  console.log("currentVersion (mapping): ", currentVersion);
  const existingProviders = await gitcoinDecoder.getProviders(currentVersion);
  console.log("existing providers: ", existingProviders);

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
  console.log(`🚀 new complete providers list: `, providers);

  // The new providers list must be greater than the existing one
  if (providers.length <= existingProviders.length) {
    console.log("❌ There are no new providers to be added");
    return;
  }

  // The new providers list must contain the existing providers list, at the same indexes
  if (
    !providers
      .slice(0, existingProviders.length)
      .every((p, idx) => p === existingProviders[idx])
  ) {
    console.log(
      "❌ Mismatch in existing providers and computed / configured providers"
    );
    return;
  }

  const providersToAdd = providers.slice(existingProviders.length);

  await confirmContinue({
    contract: "GitcoinDecoder",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    providersToAdd: JSON.stringify(providersToAdd)
  });

  const addProvidersData = gitcoinDecoder.interface.encodeFunctionData(
    "addProviders",
    [providersToAdd]
  );

  console.log({ addProvidersData });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
