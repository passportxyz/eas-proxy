import readline from "readline";
import * as dotenv from "dotenv";
import { utils, BaseContract, ContractFactory } from "ethers";
import fs from "fs";

dotenv.config();

/**
 * Asserts that environment variables are set as expected
 */
export const assertEnvironment = () => {
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    console.error("Please set your DEPLOYER_PRIVATE_KEY in a .env file");
  }
  if (!process.env.PROVIDER_URL) {
    console.error("Please set your PROVIDER_URL in a .env file");
  }
  if (!process.env.IAM_ISSUER_ADDRESS) {
    console.error("Please set your IAM_ISSUER_ADDRESS in a .env file");
  }
};

/**
 * Helper method for waiting on user input. Source: https://stackoverflow.com/a/50890409
 * @param query
 */
export async function waitForInput(query: string): Promise<unknown> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

/**
 * Helper method for confirming user input
 *
 * @param params
 */
export async function confirmContinue(params: Record<string, unknown>) {
  console.log("\nPARAMETERS");
  console.table(params);

  const response = await waitForInput("\nDo you want to continue? y/N\n");
  if (response !== "y")
    throw new Error("Aborting script: User chose to exit script");
  console.log("\n");
}

export async function preHashTypeHashes() {
  const desiredHashes = [
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    "AttestationRequestData(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value)",
    "MultiAttestationRequest(bytes32 schema,AttestationRequestData[] data)AttestationRequestData(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value)",
    "PassportAttestationRequest(MultiAttestationRequest[] multiAttestationRequest,uint256 nonce,uint256 fee)AttestationRequestData(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value)MultiAttestationRequest(bytes32 schema,AttestationRequestData[] data)",
  ];
  desiredHashes.forEach((hashType) => {
    const hashedValue = utils.keccak256(utils.toUtf8Bytes(hashType));
    console.log(`"${hashType}": "${hashedValue}",`);
  });
}

export function getAbi(contract: { interface: { formatJson: () => string } }) {
  const abi = contract.interface.formatJson();
  return JSON.parse(abi);
}

// For updating proxies, don't pass the address in order to reuse the existing one
export async function updateDeploymentsFile(
  contractName: string,
  abi: any,
  chainId?: number,
  newAddress?: string
) {
  let hexChainId = "0x" + chainId?.toString(16);
  if (!chainId) {
    console.error("No chain ID, assuming local deployment");
    hexChainId = "0x7a69";
  }

  const deploymentsFilePath = "./deployments.json";

  let existingChainConfig: Record<string, any> = {};

  try {
    // read current chain config from local file
    existingChainConfig = JSON.parse(
      fs.readFileSync(deploymentsFilePath, "utf8")
    );
  } catch {}

  const contractData: { abi: any; address?: string } = {
    abi,
  };

  if (newAddress) contractData.address = newAddress;

  const newChainConfig = {
    ...existingChainConfig,
    [hexChainId]: {
      ...existingChainConfig[hexChainId],
      [contractName]: {
        ...existingChainConfig[hexChainId]?.[contractName],
        ...contractData,
      },
    },
  };

  // overwrite the deployments.json file with the new one
  fs.writeFileSync(
    deploymentsFilePath,
    JSON.stringify(newChainConfig, null, 2)
  );

  console.log(
    `✅ Updated ${deploymentsFilePath} with new ${contractName} info`
  );
}
