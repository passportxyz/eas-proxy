import { ethers } from "hardhat";

const CONTRACT_ADDRESS = "0x18494Fecf61d2282c45b8bf481403C1fcb5D94E6";

async function main() {
  console.log("Requesting credits from contract:", CONTRACT_ADDRESS);

  // Get private key from environment
  const privateKey = process.env.HN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("HN_PRIVATE_KEY environment variable not set");
  }

  // Create wallet from private key
  const provider = ethers.provider;
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("Using account:", wallet.address);

  // Contract ABI
  const abi = ["function requestCredits() external"];

  // Connect to contract
  const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

  // Request credits
  console.log("Sending transaction...");
  const tx = await contract.requestCredits();
  console.log("Transaction hash:", tx.hash);

  // Wait for confirmation
  const receipt = await tx.wait();
  console.log("Transaction confirmed!");
  console.log("Block number:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

