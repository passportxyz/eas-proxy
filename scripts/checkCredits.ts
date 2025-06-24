import { ethers } from "hardhat";

const CONTRACT_ADDRESS = "0x18494Fecf61d2282c45b8bf481403C1fcb5D94E6";

// User addresses to check
const ADDRESSES = {
  "review/staging": "0xdD4E810D50f07fB77d4c6A9CCe0399e75bfcd972",
  production: "0x58fAF5ECe7916A30e401f5dc638e3539376279b7"
};

async function main() {
  console.log("Checking credits on contract:", CONTRACT_ADDRESS);
  console.log("");

  // Contract ABI
  const abi = [
    "function creditsFor(address user) external view returns (uint256)"
  ];

  // Get provider from hardhat
  const provider = ethers.provider;

  // Connect to contract (read-only)
  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

  // Check credits for each address
  for (const [env, address] of Object.entries(ADDRESSES)) {
    const credits = await contract.creditsFor(address);
    console.log(`${env} (${address}):`);
    console.log(`  Credits: ${credits.toString()}`);
    console.log("");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

