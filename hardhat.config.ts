import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
import "@nomiclabs/hardhat-ethers";

const sepoliaRpc = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    hardhat: {
      forking: {
        url: sepoliaRpc,
      },
    },
  },
};

export default config;
