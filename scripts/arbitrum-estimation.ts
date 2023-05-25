import { utils, providers } from "ethers";
import { addDefaultLocalNetwork } from "@arbitrum/sdk";
import { ArbGasInfo__factory } from "@arbitrum/sdk/dist/lib/abi/factories/ArbGasInfo__factory";
import { NodeInterface__factory } from "@arbitrum/sdk/dist/lib/abi/factories/NodeInterface__factory";
import {
  ARB_GAS_INFO,
  NODE_INTERFACE_ADDRESS,
} from "@arbitrum/sdk/dist/lib/dataEntities/constants";

import { ethers } from "ethers";

const { requireEnvVariables } = require("arb-shared-dependencies");

// Importing configuration //
require("dotenv").config();
requireEnvVariables(["PROVIDER_URL"]);

// Initial setup //
const baseL2Provider = new providers.StaticJsonRpcProvider(
  process.env.PROVIDER_URL
);

const GENERIC_NON_ZERO_ADDRESS = "0xFa64f316e627aD8360de2476aF0dD9250018CFc5";

// The input data of the transaction, in hex. You can find examples of this information in Arbiscan,
// in the "Input Data" field of a transaction.
// (You can modify this value to fit your needs)
const txData =
  "0x8327a7eed83994d5459162a259c3a18d3db267ca05982f1e1e261d5388a8bfe2a2a2c7f900000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000001b1962f48bab049ce6a1ea38a4d4c7fcb607fa95c2aee64c3cd90a90d660f8334a523d4457f7e85f2c6c3b1571991ffd3c66005ac15584f7044599bce35f95a518000000000000000000000000000000000000000000000000000000000000010000000000000000000000000028c0579bac08317300fe591d42ed66fefc7efcd2000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000003ee31f0c21d8f0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000040b03cac9e8f0914ebb46e62ddee5a8337dcf4cdf6284173ebfb4aa777d5f481bee321ee5c9251973c5a6f2987008b17c160a9b44467d999ce33f8b9085d3ea5b500000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000040aca425548e16bd36fb542900597c32be27d7544a35bba21107894728faf6ecb9e7aae4857a88bde9833a33802f1bd9a8b187c1b52845a49ee935bc1e8154ea35";

const gasEstimator = async () => {
  // ***************************
  // * Gas formula explanation *
  // ***************************
  //
  // Transaction fees (TXFEES) = L2 Gas Price (P) * Gas Limit (G)
  //      ----> Gas Limit (G) = L2 Gas used (L2G) + Extra Buffer for L1 cost (B)
  //      ----> L1 Estimated Cost (L1C) = L1 estimated calldata price per byte (L1P) * L1 Calldata size in bytes (L1S)
  //      ----> Extra Buffer (B) = L1 Cost (L1C) / L2 Gas Price (P)
  //
  // TXFEES = P * (L2G + ((L1P * L1S) / P))

  // ********************************************
  // * How do we get all parts of that equation *
  // ********************************************
  // P (L2 Gas Price) =>
  //      ArbGasInfo.getPricesInWei() and get the sixth element => result[5]
  //      NodeInterface.GasEstimateL1Component() and get the second element => result[1]
  //      NodeInterface.GasEstimateComponents() and get the third element => result[2]
  // L2G (L2 Gas used) => Will depend on the transaction itself
  // L1P (L1 estimated calldata price per byte) =>
  //      (this is the L2's estimated view of the current L1's price per byte of data, which the L2 dynamically adjusts over time)
  //      ArbGasInfo.getL1BaseFeeEstimate() and multiply by 16
  //      ArbGasInfo.getL1GasPriceEstimate() and multiply by 16
  //      ArbGasInfo.getPricesInWei() and get the second element => result[1]
  //      NodeInterface.GasEstimateL1Component() and get the third element and multiply by 16 => result[2]*16
  //      NodeInterface.GasEstimateComponents() and get the fourth element and multiply by 16 => result[3]*16
  // L1S (Size in bytes of the calldata to post on L1) =>
  //      Will depend on the size (in bytes) of the calldata of the transaction
  //      We add a fixed amount of 140 bytes to that amount for the transaction metadata (recipient, nonce, gas price, ...)
  //      Final size will be less after compression, but this calculation gives a good estimation

  // ****************************
  // * Other values you can get *
  // ****************************
  // B =>
  //      NodeInterface.GasEstimateL1Component() and get the first element => result[0]
  //      NodeInterface.GasEstimateComponents() and get the second element => result[1]
  //

  // Add the default local network configuration to the SDK
  // to allow this script to run on a local node
  addDefaultLocalNetwork();

  // Instantiation of the ArbGasInfo and NodeInterface objects
  const arbGasInfo = ArbGasInfo__factory.connect(ARB_GAS_INFO, baseL2Provider);
  const nodeInterface = NodeInterface__factory.connect(
    NODE_INTERFACE_ADDRESS,
    baseL2Provider
  );

  // Getting the gas prices from ArbGasInfo.getPricesInWei()
  const gasComponents = await arbGasInfo.callStatic.getPricesInWei();

  // And the estimations from NodeInterface.GasEstimateComponents()
  const gasEstimateComponents =
    await nodeInterface.callStatic.gasEstimateComponents(
      GENERIC_NON_ZERO_ADDRESS,
      false,
      txData
    );
  const l2GasUsed = gasEstimateComponents.gasEstimate.sub(
    gasEstimateComponents.gasEstimateForL1
  );

  // Setting the variables of the formula
  const P = gasComponents[5];
  const L2G = l2GasUsed;
  const L1P = gasComponents[1];
  const L1S = 140 + utils.hexDataLength(txData);

  // Getting the result of the formula
  // ---------------------------------

  // L1C (L1 Cost) = L1P * L1S
  const L1C = L1P.mul(L1S);

  // B (Extra Buffer) = L1C / P
  const B = L1C.div(P);

  // G (Gas Limit) = L2G + B
  const G = L2G.add(B);

  // TXFEES (Transaction fees) = P * G
  const TXFEES = P.mul(G);

  console.log("Transaction summary");
  console.log("-------------------");
  console.log(`P (L2 Gas Price) = ${utils.formatUnits(P, "gwei")} gwei`);
  console.log(`L2G (L2 Gas used) = ${L2G.toNumber()} units`);
  console.log(
    `L1P (L1 estimated calldata price per byte) = ${utils.formatUnits(
      L1P,
      "gwei"
    )} gwei`
  );
  console.log(`L1S (L1 Calldata size in bytes) = ${L1S} bytes`);
  console.log("-------------------");
  console.log(
    `Transaction estimated fees to pay = ${utils.formatEther(TXFEES)} ETH`
  );
};

gasEstimator()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
