import hre, { ethers, upgrades } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getAttesterAddress,
  getIssuerAddress,
  updateDeploymentsFile,
  getAbi,
  getFeeAddress
} from "./lib/utils";

assertEnvironment();

const PORTAL_ADDRESS = "0xCAa9E817f02486cE076560B77A86235Ef91c5d5D";

export async function main() {
  const issuerAddress = getIssuerAddress();
  const feeAddress = getFeeAddress();

  await confirmContinue({
    contract: "GitcoinVerifierWithVeraxPortal",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    issuerAddress,
    feeAddress,
    portalAddress: PORTAL_ADDRESS
  });

  const GitcoinVerifierWithVeraxPortal = await ethers.getContractFactory(
    "GitcoinVerifierWithVeraxPortal"
  );

  const verifier = await upgrades.deployProxy(
    GitcoinVerifierWithVeraxPortal,
    [issuerAddress, getAttesterAddress(), feeAddress, PORTAL_ADDRESS],
    {
      kind: "uups",
      initializer: "initialize(address,address,address,address)"
    }
  );

  const deployment = await verifier.waitForDeployment();

  const verifierAddress = await deployment.getAddress();
  console.log(
    `✅ Deployed GitcoinVerifierWithVeraxPortal to ${verifierAddress}`
  );

  await updateDeploymentsFile(
    "GitcoinVerifier",
    getAbi(deployment),
    verifierAddress
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
