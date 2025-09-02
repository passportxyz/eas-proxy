import hre, { ethers } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getAttesterAddress,
  getVerifierAddress
} from "./lib/utils";

assertEnvironment();

const PORTAL_ADDRESS = "0xCAa9E817f02486cE076560B77A86235Ef91c5d5D";

export async function main() {
  const verifierAddress = getVerifierAddress();
  const attesterAddress = getAttesterAddress();

  const GitcoinAttester = await ethers.getContractFactory("GitcoinAttester");
  const passportAttester = GitcoinAttester.attach(attesterAddress);

  const GitcoinVeraxPortal = await ethers.getContractFactory(
    "GitcoinVeraxPortal"
  );
  const portal = GitcoinVeraxPortal.attach(PORTAL_ADDRESS);

  await confirmContinue({
    contract: `Adding verifier ${verifierAddress} to attester ${attesterAddress}`,
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    attesterAddress: attesterAddress,
    verifierAddress: verifierAddress,
    portalAddress: PORTAL_ADDRESS
  });

  const tx = await passportAttester.addVerifier.populateTransaction(
    verifierAddress
  );

  console.log(
    `🚀 Please execute the following transaction to add the verifier to the attester:`
  );

  console.log(
    JSON.stringify(
      {
        chain: hre.network.name,
        contract: tx.to,
        tx: tx.data
      },
      null,
      2
    )
  );

  const portalTx = await portal.addToAllowlist.populateTransaction(
    verifierAddress
  );

  console.log(
    `🚀 Please execute the following transaction to add the verifier to the portal:`
  );

  console.log(
    JSON.stringify(
      {
        chain: hre.network.name,
        contract: portalTx.to,
        tx: portalTx.data
      },
      null,
      2
    )
  );
}

main();
