import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-ethers";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";

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
    apiKey: process.env.ETHERSCAN_API_KEY as string,
    customChains: [
      {
        network: "linea_mainnet",
        chainId: 59144,
        urls: {
          apiURL: "https://api.lineascan.build/api",
          browserURL: "https://lineascan.build/",
        },
      },
      {
        network: "baseGoerli",
        chainId: 84531,
        urls: {
          apiURL: "https://api-goerli.basescan.org/api",
          browserURL: "https://goerli.basescan.org/",
        },
      },
      {
        network: "linea-goerli",
        chainId: 59140,
        urls: {
          apiURL: "https://api.lineascan.build/api",
          browserURL: "https://goerli.lineascan.build/",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
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

if (process.env.DEPLOYER_PRIVATE_KEY && process.env.DEPLOYER_ADDRESS) {
  if (config.networks) {
    if (process.env.PROVIDER_URL) {
      config.networks["sepolia"] = {
        url: process.env.PROVIDER_URL as string,
        accounts: [process.env.DEPLOYER_PRIVATE_KEY as string],
        chainId: 11155111,
        from: process.env.DEPLOYER_ADDRESS as string,
      };
    }
    if (process.env.OP_PROVIDER_URL) {
      config.networks["optimism"] = {
        url: process.env.OP_PROVIDER_URL as string,
        accounts: [process.env.DEPLOYER_PRIVATE_KEY as string],
        chainId: 10,
        from: process.env.DEPLOYER_ADDRESS as string,
      };
    }
    if (process.env.OP_GOERLI_PROVIDER_URL) {
      config.networks["optimism-goerli"] = {
        url: process.env.OP_GOERLI_PROVIDER_URL as string,
        accounts: [process.env.DEPLOYER_PRIVATE_KEY as string],
        chainId: 420,
        from: process.env.DEPLOYER_ADDRESS as string,
      };
    }
  }
}

if (
  process.env.DEPLOYER_PRIVATE_KEY &&
  process.env.INFURA_KEY &&
  config.networks
) {
  config.networks["linea-goerli"] = {
    chainId: 59140,
    gasPrice: 582000007,
    url: `https://linea-goerli.infura.io/v3/${process.env.INFURA_KEY ?? ""}`,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY ?? ""],
  };
  config.networks["linea"] = {
    chainId: 59144,
    url: `https://linea-mainnet.infura.io/v3/${process.env.INFURA_KEY ?? ""}`,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY ?? ""],
  };
}

if (
  process.env.CB_PROVIDER_URL &&
  process.env.CB_PRIVATE_KEY &&
  process.env.CB_ADDRESS
) {
  if (config.networks) {
    config.networks["baseGoerli"] = {
      gasPrice: 1000005,
      url: process.env.CB_PROVIDER_URL as string,
      accounts: [process.env.CB_PRIVATE_KEY as string],
      chainId: 84531,
      from: process.env.CB_ADDRESS as string,
    };
  }
}

export default config;
