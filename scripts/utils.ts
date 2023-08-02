import readline from "readline";
import * as dotenv from "dotenv";
import { utils } from "ethers";
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

export function getAbi(contract: {
  interface: { format: () => string[] };
}): string[] {
  return contract.interface.format();
}

// For updating proxies, don't pass the address in order to reuse the existing one
export async function updateDeploymentsFile(
  contractName: string,
  abi: string[],
  chainId?: number,
  newAddress?: string
) {
  let hexChainId = "0x" + chainId?.toString(16);
  if (!chainId) {
    console.log("⚠️  No chain ID, assuming local deployment");
    hexChainId = "0x7a69";
  }

  const outputDir = "./deployments";
  const infoFile = `${outputDir}/onchainInfo.json`;
  const abiDir = `${outputDir}/abi`;
  const abiFile = `${abiDir}/${contractName}.json`;

  if (!fs.existsSync("./deployments")) {
    fs.mkdirSync("./deployments");
  }

  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir);
  }

  if (newAddress) {
    addChainInfoToFile(infoFile, hexChainId, (thisChainExistingInfo) => ({
      ...thisChainExistingInfo,
      [contractName]: {
        address: newAddress,
      },
    }));

    console.log(`✅ Updated ${infoFile} with new ${contractName} info`);
  }

  addChainInfoToFile(abiFile, hexChainId, () => abi);

  console.log(`✅ Updated ${abiFile}`);

  console.log(
    `✏️  You should copy the ${outputDir} directory to the Passport frontend, overwriting the current one`
  );
}

function addChainInfoToFile(
  file: string,
  hexChainId: string,
  updater: (thisChainExistingInfo: any) => any
) {
  let existingInfo: Record<string, any> = {};

  try {
    // read current chain config from local file
    existingInfo = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {}

  const thisChainExistingInfo = existingInfo[hexChainId] || {};
  const thisChainNewInfo = updater(thisChainExistingInfo);

  const newInfo = {
    ...existingInfo,
    [hexChainId]: thisChainNewInfo,
  };

  fs.writeFileSync(file, JSON.stringify(newInfo, null, 2));
}
