// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockStableCoin
/// @notice Testnet-only ERC-20 stand-in for real stablecoins (USDC, USDT) and a
///         PHP-pegged demo token. Morph Hoodi has no canonical stablecoins, so we
///         deploy these to exercise the `PalengkePayment.payToken` path end to end.
///
/// @dev Decimals are configurable per token (USDC/USDT use 6). Minting is OPEN —
///      `faucet()` lets any wallet self-fund for the demo, and `mint()` lets the
///      seed script provision balances. This is acceptable ONLY on a testnet mock;
///      never deploy this with open mint on mainnet.
contract MockStableCoin is ERC20 {
    uint8 private immutable _decimals;

    /// @notice One faucet pull mints 1,000 whole tokens to the caller.
    uint256 public constant FAUCET_AMOUNT = 1_000;

    constructor(string memory name_, string memory symbol_, uint8 decimals_)
        ERC20(name_, symbol_)
    {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Mint `FAUCET_AMOUNT` whole tokens to the caller (testnet self-fund).
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT * 10 ** _decimals);
    }

    /// @notice Mint an arbitrary raw amount to `to` (seed script / demo provisioning).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
