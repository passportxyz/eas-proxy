import hre, { ethers, upgrades, platform } from "hardhat";
import { confirmContinue, assertEnvironment } from "./utils";
import { getProxyAdminFactory } from "@openzeppelin/hardhat-upgrades/dist/utils";

assertEnvironment();

export async function main() {
  await confirmContinue({
    contract: "GitcoinAttester",
    network: hre.network.name,
    chainId: hre.network.config.chainId,
  });

  if (!process.env.GITCOIN_ATTESTER_ADDRESS) {
    console.error("Please set your GITCOIN_ATTESTER_ADDRESS in a .env file");
  }

  // TODO: use update implementation
  const GitcoinAttesterUpdate = await ethers.getContractFactory(
    "GitcoinAttester"
  );
  const gitcoinAttesterUpdate = await GitcoinAttesterUpdate.deploy();
  const deployment = await gitcoinAttesterUpdate.waitForDeployment();
  const deployedUpgradedContractAddress =
    await gitcoinAttesterUpdate.getAddress();
  console.log(
    `✅ Deployed GitcoinAttester. ${deployedUpgradedContractAddress}`
  );

  // Get ProxyAdmin instance
  const proxyAdminAddress = process.env.ATTESTER_PROXY_ADMIN_ADDRESS || "";
  const ProxyAdmin = await getProxyAdminFactory(hre);
  const proxyAdminContract = ProxyAdmin.attach(proxyAdminAddress);

  // Encode upgrade transaction
  const upgradeData = proxyAdminContract.interface.encodeFunctionData(
    "upgrade",
    [
      process.env.GITCOIN_ATTESTER_ADDRESS || "",
      deployedUpgradedContractAddress,
    ]
  );
  console.log(`Upgrade transaction data: ${upgradeData}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
