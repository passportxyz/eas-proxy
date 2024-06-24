import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getVerifierAddress
} from "./lib/utils";

assertEnvironment();

export async function main() {
  if(!process.env.GITCOIN_VERIFIER_WITHDRAW_ETH_AMOUNT) {
    console.error("GITCOIN_VERIFIER_WITHDRAW_ETH_AMOUNT is required");
    throw "GITCOIN_VERIFIER_WITHDRAW_ETH_AMOUNT is required";
  }
  const ethAmount = process.env.GITCOIN_VERIFIER_WITHDRAW_ETH_AMOUNT || "undefined";
  const ethAmountInWei = ethers.parseEther(ethAmount);

  await confirmContinue({
    contract: "GitcoinVerifier",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    ethAmount: ethAmount,
    ethAmountInWei: ethAmountInWei
  });

  const verifierAddress = getVerifierAddress();
  const GitcoinVerifier = await ethers.getContractFactory("GitcoinVerifier");
  const gitcoinVerifier = GitcoinVerifier.attach(verifierAddress);

  const withdrawFeesData = gitcoinVerifier.interface.encodeFunctionData(
    "withdrawFees",
    [ethAmountInWei]
  );

  console.log({ withdrawFeesData });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
