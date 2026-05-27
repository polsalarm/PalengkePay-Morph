// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PalengkePayment} from "../src/PalengkePayment.sol";
import {VendorRegistry} from "../src/VendorRegistry.sol";
import {UTangEscrow} from "../src/UTangEscrow.sol";

/// @notice Deploys all three contracts to Morph Holesky.
/// Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $MORPH_HOLESKY_RPC --broadcast --verify --verifier blockscout \
///     --verifier-url https://explorer-holesky.morphl2.io/api
/// Env: DEPLOYER_KEY (uint), ADMIN_ADDRESS (address).
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");

        vm.startBroadcast(deployerKey);
        PalengkePayment payment = new PalengkePayment();
        VendorRegistry registry = new VendorRegistry(admin);
        UTangEscrow escrow = new UTangEscrow(admin);
        vm.stopBroadcast();

        console.log("PalengkePayment :", address(payment));
        console.log("VendorRegistry  :", address(registry));
        console.log("UTangEscrow     :", address(escrow));
        console.log("admin           :", admin);
    }
}
