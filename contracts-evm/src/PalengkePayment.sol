// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PalengkePayment
/// @notice Payment pass-through. Customer pays a vendor; the full amount is forwarded
///         with no fee skim and the contract never takes custody. Two settlement modes:
///           - `pay()`       — native ETH (msg.value), `token == address(0)`.
///           - `payToken()`  — any ERC-20 (USDC/USDT/PHP-peg), via transferFrom.
///
/// Stellar-isms intentionally dropped on EVM:
///   - `set_token` / `token()`  — settlement token is per-payment now (address(0)=native)
///   - `initialize(admin, fee_bps, ...)` — no admin needed; this contract holds no funds
///   - `upgrade(wasm_hash)` — redeploy instead (testnet); add UUPS later if mainnet needs it
contract PalengkePayment is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @dev `token == address(0)` denotes a native-ETH payment; otherwise the ERC-20 paid.
    struct Payment {
        uint256 id;
        address customer;
        address vendor;
        address token;
        uint256 amount;
        uint256 timestamp;
        string memo;
    }

    /// @notice Monotonic payment id. First payment is id 1 (id 0 == "not found").
    uint256 public paymentCount;

    mapping(uint256 => Payment) private payments;
    mapping(address => uint256[]) private vendorPaymentIds;
    mapping(address => uint256[]) private customerPaymentIds;

    /// @dev `token` is address(0) for native ETH, else the ERC-20 contract address.
    event PaymentCompleted(
        uint256 indexed paymentId,
        address indexed customer,
        address indexed vendor,
        address token,
        uint256 amount,
        uint256 timestamp,
        string memo
    );

    error AmountMustBePositive();
    error VendorTransferFailed();
    error PaymentNotFound();
    error TokenRequired();

    /// @notice Pay `vendor` the attached ETH. Customer is `msg.sender`, amount is `msg.value`.
    /// @return paymentId monotonic id of the recorded payment.
    function pay(address vendor, string calldata memo)
        external
        payable
        nonReentrant
        returns (uint256 paymentId)
    {
        if (msg.value == 0) revert AmountMustBePositive();

        paymentId = _record(msg.sender, vendor, address(0), msg.value, memo);

        // Effects emitted before the external call (checks-effects-interactions + nonReentrant).
        (bool ok,) = payable(vendor).call{value: msg.value}("");
        if (!ok) revert VendorTransferFailed();
    }

    /// @notice Pay `vendor` `amount` of ERC-20 `token`. Requires prior `approve(this, amount)`.
    ///         Funds move customer -> vendor directly; this contract never holds the tokens.
    /// @return paymentId monotonic id of the recorded payment.
    function payToken(address vendor, address token, uint256 amount, string calldata memo)
        external
        nonReentrant
        returns (uint256 paymentId)
    {
        if (token == address(0)) revert TokenRequired();
        if (amount == 0) revert AmountMustBePositive();

        paymentId = _record(msg.sender, vendor, token, amount, memo);

        IERC20(token).safeTransferFrom(msg.sender, vendor, amount);
    }

    function _record(address customer, address vendor, address token, uint256 amount, string calldata memo)
        private
        returns (uint256 paymentId)
    {
        paymentCount += 1;
        paymentId = paymentCount;

        payments[paymentId] = Payment({
            id: paymentId,
            customer: customer,
            vendor: vendor,
            token: token,
            amount: amount,
            timestamp: block.timestamp,
            memo: memo
        });
        vendorPaymentIds[vendor].push(paymentId);
        customerPaymentIds[customer].push(paymentId);

        emit PaymentCompleted(paymentId, customer, vendor, token, amount, block.timestamp, memo);
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
