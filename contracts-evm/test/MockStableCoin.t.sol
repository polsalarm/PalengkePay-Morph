// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockStableCoin} from "../src/MockStableCoin.sol";

contract MockStableCoinTest is Test {
    MockStableCoin internal usdc;
    address internal user = makeAddr("user");

    function setUp() public {
        usdc = new MockStableCoin("Mock USD Coin", "USDC", 6);
    }

    function test_DecimalsConfigurable() public view {
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.symbol(), "USDC");
    }

    function test_FaucetMintsWholeTokens() public {
        vm.prank(user);
        usdc.faucet();
        assertEq(usdc.balanceOf(user), 1_000 * 10 ** 6);
    }

    function test_MintRawAmount() public {
        usdc.mint(user, 42);
        assertEq(usdc.balanceOf(user), 42);
    }
}
