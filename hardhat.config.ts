import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    hardhat: {
      forking: {
        url: "https://sepolia.infura.io/v3/4818dbcee84d4651a832894818bd4534",
      },
    },
  },
};

export default config;
