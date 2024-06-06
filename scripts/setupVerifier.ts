import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getAttesterAddress,
  getVerifierAddress
} from "./lib/utils";

assertEnvironment();

export async function main() {
  const verifierAddress = getVerifierAddress();
  const attesterAddress = getAttesterAddress();

  const GitcoinAttester = await ethers.getContractFactory(
    "GitcoinAttester"
  );
  const passportAttester = GitcoinAttester.attach(
    attesterAddress
  );

  await confirmContinue({
    contract: `Adding verifier ${verifierAddress} to attester ${attesterAddress}`,
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    attesterAddress: attesterAddress,
    verifierAddress: verifierAddress
  });

  await passportAttester.addVerifier(verifierAddress);

  console.log(`✅ Added verifier ${verifierAddress} to attester ${attesterAddress}.`);
}

main();
