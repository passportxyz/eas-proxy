import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    hardhat: {
      forking: {
        url: process.env.PROVIDER_URL as string,
      },
    },
    sepolia: {
      url: process.env.PROVIDER_URL as string,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY as string],
    },
  },
};

export default config;
