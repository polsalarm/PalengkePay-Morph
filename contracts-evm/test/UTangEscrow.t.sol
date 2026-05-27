// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {UTangEscrow} from "../src/UTangEscrow.sol";

contract UTangEscrowTest is Test {
    UTangEscrow internal escrow;
    address internal admin = makeAddr("admin");
    address internal vendor = makeAddr("vendor");
    address internal customer = makeAddr("customer");

    uint64 internal constant INTERVAL = 7 days;

    function setUp() public {
        vm.prank(admin);
        escrow = new UTangEscrow(admin);
        vm.deal(customer, 100 ether);
    }

    function _create(uint256 total, uint32 n) internal returns (uint64 id) {
        vm.prank(customer);
        id = escrow.createUtang(vendor, total, n, INTERVAL, "sako bigas");
    }

    function test_CreateUtang() public {
        uint64 id = _create(10 ether, 4);
        UTangEscrow.Utang memory u = escrow.getUtang(id);
        assertEq(u.totalAmount, 10 ether);
        assertEq(u.installmentAmount, 2.5 ether); // ceil(10/4)
        assertEq(escrow.activeUtangCount(), 1);
    }

    function test_PayInstallment_ReserveSkimAndForward() public {
        uint64 id = _create(4 ether, 4); // installment = 1 ether
        uint256 reserveFee = (1 ether * 100) / 10_000; // 1%

        vm.prank(customer);
        escrow.payInstallment{value: 1 ether + reserveFee}(id);

        assertEq(vendor.balance, 1 ether);
        assertEq(escrow.utangReserve(id), reserveFee);
        assertEq(escrow.getUtang(id).installmentsPaid, 1);
    }

    function test_RevertWhen_WrongPaymentAmount() public {
        uint64 id = _create(4 ether, 4);
        vm.prank(customer);
        vm.expectRevert();
        escrow.payInstallment{value: 1 ether}(id); // missing reserve fee
    }

    function test_CompletionRefundsReserveToCustomer() public {
        uint64 id = _create(2 ether, 2); // installment = 1 ether
        uint256 reserveFee = (1 ether * 100) / 10_000;

        vm.startPrank(customer);
        escrow.payInstallment{value: 1 ether + reserveFee}(id);
        uint256 balBefore = customer.balance;
        // final installment: remainingAmount == 1 ether, reserve still skimmed
        escrow.payInstallment{value: 1 ether + reserveFee}(id);
        vm.stopPrank();

        UTangEscrow.Utang memory u = escrow.getUtang(id);
        assertEq(uint8(u.status), uint8(UTangEscrow.UtangStatus.Completed));
        assertEq(escrow.utangReserve(id), 0);
        assertEq(escrow.activeUtangCount(), 0);
        // customer paid 1e + fee, then got back 2x accumulated reserve on completion
        assertEq(customer.balance, balBefore - (1 ether + reserveFee) + 2 * reserveFee);
        assertEq(vendor.balance, 2 ether);
    }

    function test_MarkDefaultPaysReserveToVendor() public {
        uint64 id = _create(4 ether, 4);
        uint256 reserveFee = (1 ether * 100) / 10_000;
        vm.prank(customer);
        escrow.payInstallment{value: 1 ether + reserveFee}(id);

        // jump past next_due + grace (next_due advanced one interval on the paid installment)
        vm.warp(escrow.getUtang(id).nextDue + escrow.gracePeriod() + 1);
        assertTrue(escrow.isOverdue(id));

        vm.prank(admin);
        escrow.markDefault(id);

        UTangEscrow.Utang memory u = escrow.getUtang(id);
        assertEq(uint8(u.status), uint8(UTangEscrow.UtangStatus.Defaulted));
        assertEq(escrow.vendorDefaults(vendor), 1);
        assertEq(escrow.customerDefaults(customer), 1);
        assertEq(vendor.balance, 1 ether + reserveFee); // installment + reserve payout
        assertEq(escrow.activeUtangCount(), 0);
    }

    function test_ResumeAfterLate() public {
        uint64 id = _create(4 ether, 4);
        uint256 reserveFee = (1 ether * 100) / 10_000;
        vm.prank(customer);
        escrow.payInstallment{value: 1 ether + reserveFee}(id);

        vm.warp(escrow.getUtang(id).nextDue + escrow.gracePeriod() + 1);
        vm.prank(admin);
        escrow.markDefault(id);

        uint256 lateFee = (1 ether * 500) / 10_000; // 5% of installment
        vm.prank(customer);
        escrow.resumeAfterLate{value: lateFee}(id);

        UTangEscrow.Utang memory u = escrow.getUtang(id);
        assertEq(uint8(u.status), uint8(UTangEscrow.UtangStatus.Active));
        assertEq(escrow.activeUtangCount(), 1);
    }

    function test_RevertWhen_DegenerateInstallmentPlan() public {
        // total=5, n=4 -> installment=ceil(5/4)=2; first 3 pay 6 >= 5 -> rejected
        vm.prank(customer);
        vm.expectRevert(UTangEscrow.DegenerateInstallmentPlan.selector);
        escrow.createUtang(vendor, 5, 4, INTERVAL, "sako bigas");
    }

    function test_RevertWhen_MarkDefaultBeforeGrace() public {
        uint64 id = _create(4 ether, 4);
        vm.prank(admin);
        vm.expectRevert(UTangEscrow.GracePeriodNotElapsed.selector);
        escrow.markDefault(id);
    }
}
