// This script deals with deploying the GitcoinAttester on a given network
import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  getThisChainInfo,
  addChainInfoToFile,
  INFO_FILE,
  getHexChainId,
} from "./lib/utils";

export async function main() {
  await confirmContinue({
    contract: "Generating onchainInfo for this chain",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  try {
    getThisChainInfo();
    console.log("❌  onchainInfo.json already contains info for this chain");
  } catch {
    const chainId = getHexChainId();
    addChainInfoToFile(INFO_FILE, chainId, () => {
      return {
        issuer: { address: "" },
        EAS: { address: "" },
        GitcoinAttester: {},
        GitcoinVerifier: {},
        GitcoinResolver: {},
        GitcoinPassportDecoder: {},
        easSchemas: {
          passport: {
            uid: "",
          },
          score: {
            uid: "",
          },
        },
      };
    });

    console.log(
      "✅ Generated onchainInfo for this chain",
      chainId,
      "at",
      INFO_FILE
    );
    console.log(
      "✏️  Please fill in the issuer and EAS addresses in onchainInfo.json for this chain"
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
