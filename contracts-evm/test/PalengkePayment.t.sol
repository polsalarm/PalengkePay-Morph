// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PalengkePayment} from "../src/PalengkePayment.sol";

contract PalengkePaymentTest is Test {
    PalengkePayment internal pay;
    address internal customer = makeAddr("customer");
    address internal vendor = makeAddr("vendor");

    event PaymentCompleted(
        uint256 indexed paymentId,
        address indexed customer,
        address indexed vendor,
        uint256 amount,
        uint256 timestamp,
        string memo
    );

    function setUp() public {
        pay = new PalengkePayment();
        vm.deal(customer, 100 ether);
    }

    function test_PayForwardsToVendorAndRecords() public {
        vm.prank(customer);
        uint256 id = pay.pay{value: 1 ether}(vendor, "isda");

        assertEq(id, 1);
        assertEq(pay.paymentCount(), 1);
        assertEq(vendor.balance, 1 ether);

        PalengkePayment.Payment memory p = pay.getPayment(1);
        assertEq(p.customer, customer);
        assertEq(p.vendor, vendor);
        assertEq(p.amount, 1 ether);
        assertEq(p.memo, "isda");
    }

    function test_PayEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit PaymentCompleted(1, customer, vendor, 1 ether, block.timestamp, "gulay");
        vm.prank(customer);
        pay.pay{value: 1 ether}(vendor, "gulay");
    }

    function test_RevertWhen_ZeroValue() public {
        vm.prank(customer);
        vm.expectRevert(PalengkePayment.AmountMustBePositive.selector);
        pay.pay{value: 0}(vendor, "");
    }

    function test_RevertWhen_PaymentNotFound() public {
        vm.expectRevert(PalengkePayment.PaymentNotFound.selector);
        pay.getPayment(99);
    }

    function test_VendorPaymentsPagination() public {
        vm.startPrank(customer);
        pay.pay{value: 1 ether}(vendor, "a");
        pay.pay{value: 1 ether}(vendor, "b");
        pay.pay{value: 1 ether}(vendor, "c");
        vm.stopPrank();

        PalengkePayment.Payment[] memory page = pay.getVendorPayments(vendor, 2, 0);
        assertEq(page.length, 2);
        assertEq(page[0].memo, "a");
        assertEq(page[1].memo, "b");

        PalengkePayment.Payment[] memory tail = pay.getVendorPayments(vendor, 2, 2);
        assertEq(tail.length, 1);
        assertEq(tail[0].memo, "c");

        PalengkePayment.Payment[] memory past = pay.getVendorPayments(vendor, 2, 5);
        assertEq(past.length, 0);
    }
}
