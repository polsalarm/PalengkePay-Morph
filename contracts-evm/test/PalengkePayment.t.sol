// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PalengkePayment} from "../src/PalengkePayment.sol";
import {MockStableCoin} from "../src/MockStableCoin.sol";

contract PalengkePaymentTest is Test {
    PalengkePayment internal pay;
    MockStableCoin internal usdc;
    address internal customer = makeAddr("customer");
    address internal vendor = makeAddr("vendor");

    event PaymentCompleted(
        uint256 indexed paymentId,
        address indexed customer,
        address indexed vendor,
        address token,
        uint256 amount,
        uint256 timestamp,
        string memo
    );

    function setUp() public {
        pay = new PalengkePayment();
        usdc = new MockStableCoin("Mock USD Coin", "USDC", 6);
        vm.deal(customer, 100 ether);
        usdc.mint(customer, 1_000_000); // 1.0 USDC (6 dp)
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
        assertEq(p.token, address(0));
        assertEq(p.amount, 1 ether);
        assertEq(p.memo, "isda");
    }

    function test_PayEmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit PaymentCompleted(1, customer, vendor, address(0), 1 ether, block.timestamp, "gulay");
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

    function test_PayTokenTransfersAndRecords() public {
        vm.startPrank(customer);
        usdc.approve(address(pay), 250_000);
        uint256 id = pay.payToken(vendor, address(usdc), 250_000, "tinapa");
        vm.stopPrank();

        assertEq(id, 1);
        assertEq(usdc.balanceOf(vendor), 250_000);
        assertEq(usdc.balanceOf(customer), 750_000);
        assertEq(usdc.balanceOf(address(pay)), 0); // no custody

        PalengkePayment.Payment memory p = pay.getPayment(1);
        assertEq(p.token, address(usdc));
        assertEq(p.amount, 250_000);
        assertEq(p.memo, "tinapa");
    }

    function test_PayTokenEmitsEvent() public {
        vm.startPrank(customer);
        usdc.approve(address(pay), 100_000);
        vm.expectEmit(true, true, true, true);
        emit PaymentCompleted(1, customer, vendor, address(usdc), 100_000, block.timestamp, "kanin");
        pay.payToken(vendor, address(usdc), 100_000, "kanin");
        vm.stopPrank();
    }

    function test_RevertWhen_PayTokenZeroAddress() public {
        vm.prank(customer);
        vm.expectRevert(PalengkePayment.TokenRequired.selector);
        pay.payToken(vendor, address(0), 100_000, "");
    }

    function test_RevertWhen_PayTokenZeroAmount() public {
        vm.prank(customer);
        vm.expectRevert(PalengkePayment.AmountMustBePositive.selector);
        pay.payToken(vendor, address(usdc), 0, "");
    }

    function test_RevertWhen_PayTokenNoAllowance() public {
        vm.prank(customer);
        vm.expectRevert(); // SafeERC20 reverts on missing allowance
        pay.payToken(vendor, address(usdc), 100_000, "");
    }

    function test_NativeAndTokenShareIdSequence() public {
        vm.startPrank(customer);
        pay.pay{value: 1 ether}(vendor, "a");
        usdc.approve(address(pay), 100_000);
        pay.payToken(vendor, address(usdc), 100_000, "b");
        vm.stopPrank();

        assertEq(pay.paymentCount(), 2);
        assertEq(pay.getPayment(1).token, address(0));
        assertEq(pay.getPayment(2).token, address(usdc));
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
