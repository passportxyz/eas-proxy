// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "hardhat/console.sol";

contract MockAggregatorV3Interface is AggregatorV3Interface {
    int private price;

    function setLatestAnswer(int _price) public {
        price = _price;
    }

    function latestRoundData()
        public
        view
        override
        returns (
            uint80,
            int,
            uint256,
            uint256,
            uint80
        )
    {
        return (0, price, 0, block.timestamp, 0);
    }

    function decimals() external view override returns (uint8) {
        return 8;
    }

    function version() external view override returns (uint256) {
        return 0;
    }

    function description() external view override returns (string memory) {
        return "Mock Aggregator V3 Interface";
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80,
            int256,
            uint256,
            uint256,
            uint80
        )
    {
        return (0, 0, 0, 0, 0);
    }
}
