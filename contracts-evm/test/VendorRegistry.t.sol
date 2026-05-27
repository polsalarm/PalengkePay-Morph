// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VendorRegistry} from "../src/VendorRegistry.sol";

contract VendorRegistryTest is Test {
    VendorRegistry internal reg;
    address internal admin = makeAddr("admin");
    address internal vendor = makeAddr("vendor");
    address internal customer = makeAddr("customer");

    function setUp() public {
        vm.prank(admin);
        reg = new VendorRegistry(admin);
    }

    function _apply(address who) internal {
        vm.prank(who);
        reg.applyVendor("market-1", "Aling Nena", "A-12", "0917", "gulay");
    }

    function test_ApplyApproveFlow() public {
        _apply(vendor);
        assertEq(reg.pendingCount(), 1);

        vm.prank(admin);
        reg.approveVendor(vendor);

        assertEq(reg.pendingCount(), 0);
        assertEq(reg.vendorCount(), 1);
        VendorRegistry.VendorRecord memory r = reg.getVendor(vendor);
        assertEq(r.id, 1);
        assertTrue(r.isActive);
        assertEq(r.name, "Aling Nena");
    }

    function test_RevertWhen_DoubleApply() public {
        _apply(vendor);
        vm.prank(vendor);
        vm.expectRevert(VendorRegistry.ApplicationAlreadyPending.selector);
        reg.applyVendor("m", "n", "s", "p", "t");
    }

    function test_RevertWhen_NonAdminApproves() public {
        _apply(vendor);
        vm.prank(customer);
        vm.expectRevert(); // AccessControlUnauthorizedAccount
        reg.approveVendor(vendor);
    }

    function test_RejectRemovesFromPending() public {
        _apply(vendor);
        vm.prank(admin);
        reg.rejectVendor(vendor);
        assertEq(reg.pendingCount(), 0);
        // Rejected applicant may re-apply.
        _apply(vendor);
        assertEq(reg.pendingCount(), 1);
    }

    function test_RegisterVendorBypass() public {
        vm.prank(admin);
        uint64 id = reg.registerVendor(vendor, "m", "n", "s", "p", "t");
        assertEq(id, 1);
        assertEq(reg.getVendor(vendor).id, 1);
    }

    function test_SubmitRatingAndAggregate() public {
        vm.prank(admin);
        reg.registerVendor(vendor, "m", "n", "s", "p", "t");

        bytes32 tx1 = keccak256("tx1");
        vm.prank(customer);
        reg.submitRating(vendor, tx1, 5, bytes32(0));

        (uint32 sum, uint32 count) = reg.getVendorRating(vendor);
        assertEq(sum, 5);
        assertEq(count, 1);
        assertTrue(reg.hasRated(vendor, tx1));

        vm.prank(customer);
        vm.expectRevert(VendorRegistry.AlreadyRated.selector);
        reg.submitRating(vendor, tx1, 4, bytes32(0));
    }

    function test_RevertWhen_StarsOutOfRange() public {
        vm.prank(admin);
        reg.registerVendor(vendor, "m", "n", "s", "p", "t");
        vm.prank(customer);
        vm.expectRevert(VendorRegistry.StarsOutOfRange.selector);
        reg.submitRating(vendor, keccak256("x"), 6, bytes32(0));
    }

    function test_ReportDefaultCounters() public {
        vm.prank(admin);
        reg.reportDefault(vendor, customer);
        assertEq(reg.vendorDefaultsReceived(vendor), 1);
        assertEq(reg.customerDefaultsHistory(customer), 1);
    }
}
