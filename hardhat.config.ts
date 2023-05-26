import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";
import "hardhat-gas-reporter";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.4",
      },
      {
        version: "0.8.19",
      },
      {
        version: "0.8.18",
      },
      {
        version: "0.8.0",
      },
    ],
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.PROVIDER_URL as string,
      },
    },
    sepolia: {
      url: process.env.PROVIDER_URL as string,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY as string],
      chainId: 11155111,
      from: process.env.DEPLOYER_ADDRESS as string,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY as string,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
};

export default config;
