import readline from "readline";
import * as dotenv from "dotenv";
import { utils } from "ethers";

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
