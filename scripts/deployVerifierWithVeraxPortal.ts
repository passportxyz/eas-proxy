import hre, { ethers, upgrades } from "hardhat";
import {
  confirmContinue,
  assertEnvironment,
  getAttesterAddress,
  getIssuerAddress,
  getVeraxAttestationRegistryAddress,
  updateDeploymentsFile,
  getAbi,
  getResolverAddress,
} from "./lib/utils";

assertEnvironment();

const DEPLOY_FAKE_VERAX_ATTESTATION_REGISTRY = false;

export async function main() {
  await confirmContinue({
    contract: "GitcoinVerifierWithVeraxPortal",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  const issuerAddress = getIssuerAddress();

  let veraxAttestationRegistryAddress;
  if (DEPLOY_FAKE_VERAX_ATTESTATION_REGISTRY) {
    const VeraxAttestationRegistry = await ethers.getContractFactory(
      "VeraxAttestationRegistry"
    );
    const veraxAttestationRegistry = await VeraxAttestationRegistry.deploy();
    veraxAttestationRegistryAddress =
      await veraxAttestationRegistry.getAddress();
  } else {
    veraxAttestationRegistryAddress = getVeraxAttestationRegistryAddress();
  }

  const GitcoinVeraxPortal = await ethers.getContractFactory(
    "GitcoinVeraxPortal"
  );

  const veraxPortal = await upgrades.deployProxy(
    GitcoinVeraxPortal,
    [
      getAttesterAddress(),
      getResolverAddress(),
      veraxAttestationRegistryAddress,
    ],
    { kind: "uups", initializer: "initialize(address,address,address)" }
  );

  const portalDeployment = await veraxPortal.waitForDeployment();

  const portalAddress = await portalDeployment.getAddress();

  console.log(`✅ Deployed GitcoinVeraxPortal to ${portalAddress}`);

  const GitcoinVerifierWithVeraxPortal = await ethers.getContractFactory(
    "GitcoinVerifierWithVeraxPortal"
  );

  const verifier = await upgrades.deployProxy(
    GitcoinVerifierWithVeraxPortal,
    [issuerAddress, getAttesterAddress(), await veraxPortal.getAddress()],
    {
      kind: "uups",
      initializer: "initialize(address,address,address)",
    }
  );

  const deployment = await verifier.waitForDeployment();

  const verifierAddress = await deployment.getAddress();
  console.log(
    `✅ Deployed GitcoinVerifierWithVeraxPortal to ${verifierAddress}`
  );

  await updateDeploymentsFile(
    "GitcoinVeraxPortal",
    getAbi(portalDeployment),
    portalAddress
  );

  await updateDeploymentsFile(
    "GitcoinVerifier",
    getAbi(deployment),
    verifierAddress
  );

  await veraxPortal.addToAllowlist(verifierAddress);
  console.log(`✅ Added ${verifierAddress} to allow list of ${portalAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
