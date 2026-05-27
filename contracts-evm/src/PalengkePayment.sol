// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PalengkePayment
/// @notice Native-ETH payment pass-through. EVM port of the Soroban `palengke-payment`
///         contract. Customer pays a vendor; full amount is forwarded, no fee skim
///         (faithful to the Soroban `pay`, which never applied its stored fee_bps).
///
/// Stellar-isms intentionally dropped on EVM:
///   - `set_token` / `token()`  — no SAC token address; settlement is native ETH (msg.value)
///   - `initialize(admin, fee_bps, ...)` — no admin needed; this contract holds no funds
///   - `upgrade(wasm_hash)` — redeploy instead (testnet); add UUPS later if mainnet needs it
contract PalengkePayment is ReentrancyGuard {
    struct Payment {
        uint256 id;
        address customer;
        address vendor;
        uint256 amount;
        uint256 timestamp;
        string memo;
    }

    /// @notice Monotonic payment id. First payment is id 1 (id 0 == "not found").
    uint256 public paymentCount;

    mapping(uint256 => Payment) private payments;
    mapping(address => uint256[]) private vendorPaymentIds;
    mapping(address => uint256[]) private customerPaymentIds;

    /// @dev Field names mirror the Soroban event so the indexer ports by find/replace.
    event PaymentCompleted(
        uint256 indexed paymentId,
        address indexed customer,
        address indexed vendor,
        uint256 amount,
        uint256 timestamp,
        string memo
    );

    error AmountMustBePositive();
    error VendorTransferFailed();
    error PaymentNotFound();

    /// @notice Pay `vendor` the attached ETH. Customer is `msg.sender`, amount is `msg.value`.
    /// @return paymentId monotonic id of the recorded payment.
    function pay(address vendor, string calldata memo)
        external
        payable
        nonReentrant
        returns (uint256 paymentId)
    {
        if (msg.value == 0) revert AmountMustBePositive();

        paymentCount += 1;
        paymentId = paymentCount;

        payments[paymentId] = Payment({
            id: paymentId,
            customer: msg.sender,
            vendor: vendor,
            amount: msg.value,
            timestamp: block.timestamp,
            memo: memo
        });
        vendorPaymentIds[vendor].push(paymentId);
        customerPaymentIds[msg.sender].push(paymentId);

        // Effects emitted before the external call (checks-effects-interactions + nonReentrant).
        emit PaymentCompleted(paymentId, msg.sender, vendor, msg.value, block.timestamp, memo);

        (bool ok,) = payable(vendor).call{value: msg.value}("");
        if (!ok) revert VendorTransferFailed();
    }

    function getPayment(uint256 paymentId) external view returns (Payment memory) {
        Payment memory p = payments[paymentId];
        if (p.id == 0) revert PaymentNotFound();
        return p;
    }

    /// @notice Paginated payments received by `vendor`. Arg order matches Soroban: (limit, offset).
    function getVendorPayments(address vendor, uint256 limit, uint256 offset)
        external
        view
        returns (Payment[] memory)
    {
        return _page(vendorPaymentIds[vendor], limit, offset);
    }

    /// @notice Paginated payments sent by `customer`. Arg order: (limit, offset).
    function getCustomerPayments(address customer, uint256 limit, uint256 offset)
        external
        view
        returns (Payment[] memory)
    {
        return _page(customerPaymentIds[customer], limit, offset);
    }

    function _page(uint256[] storage ids, uint256 limit, uint256 offset)
        private
        view
        returns (Payment[] memory)
    {
        uint256 len = ids.length;
        if (offset >= len || limit == 0) {
            return new Payment[](0);
        }
        uint256 end = offset + limit;
        if (end > len) {
            end = len;
        }
        Payment[] memory out = new Payment[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            out[i - offset] = payments[ids[i]];
        }
        return out;
    }
}
