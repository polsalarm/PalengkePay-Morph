// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PalengkePayment} from "../src/PalengkePayment.sol";
import {MockStableCoin} from "../src/MockStableCoin.sol";

/// @notice Incremental deploy for the stablecoin payment path: redeploys ONLY the
///         updated PalengkePayment (now with `payToken`) + three testnet mock
///         stablecoins. VendorRegistry and UTangEscrow are intentionally left in
///         place so seeded vendors / ratings / utang are not stranded.
/// Usage:
///   forge script script/DeployStable.s.sol:DeployStable \
///     --rpc-url $MORPH_HOODI_RPC --broadcast --verify --verifier blockscout \
///     --verifier-url https://explorer-api-hoodi.morph.network/api \
///     --legacy --with-gas-price 1000000000
/// Env: DEPLOYER_KEY (uint).
contract DeployStable is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");

        vm.startBroadcast(deployerKey);
        PalengkePayment payment = new PalengkePayment();
        MockStableCoin usdc = new MockStableCoin("Mock USD Coin", "USDC", 6);
        MockStableCoin usdt = new MockStableCoin("Mock Tether USD", "USDT", 6);
        MockStableCoin phpp = new MockStableCoin("Mock Peso", "PHPp", 6);
        vm.stopBroadcast();

        console.log("PalengkePayment :", address(payment));
        console.log("MockUSDC        :", address(usdc));
        console.log("MockUSDT        :", address(usdt));
        console.log("MockPHPp        :", address(phpp));
    }
}
