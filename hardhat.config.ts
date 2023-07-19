import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";

dotenv.config();

let config: HardhatUserConfig = {
  networks: {
    hardhat: {
      forking: {
        url: process.env.PROVIDER_URL as string,
      },
    },
  },
  etherscan: {
    apiKey: process.env.BASE_ETHERSCAN_API_KEY as string,
    customChains: [
      {
        network: "baseGoerli",
        chainId: 84531,
        urls: {
          apiURL: "https://api-goerli.basescan.org/api",
          browserURL: "https://goerli.basescan.org/",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  solidity: {
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },

    compilers: [
      {
        version: "0.8.0",
      },
      {
        version: "0.8.9",
      },
      {
        version: "0.8.18",
      },
      {
        version: "0.8.19",
      },
    ],
  },
};

if (
  process.env.PROVIDER_URL &&
  process.env.DEPLOYER_PRIVATE_KEY &&
  process.env.DEPLOYER_ADDRESS
) {
  if (config.networks) {
    config.networks["sepolia"] = {
      url: process.env.PROVIDER_URL as string,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY as string],
      chainId: 11155111,
      from: process.env.DEPLOYER_ADDRESS as string,
    };
  }
}

if (
  process.env.CB_PROVIDER_URL &&
  process.env.CB_PRIVATE_KEY &&
  process.env.CB_ADDRESS
) {
  if (config.networks) {
    config.networks["baseGoerli"] = {
      url: process.env.CB_PROVIDER_URL as string,
      accounts: [process.env.CB_PRIVATE_KEY as string],
      chainId: 84531,
      from: process.env.CB_ADDRESS as string,
    };
  }
}

export default config;
