# PalengkePay EVM contracts (Morph)

Solidity port of the Soroban contracts, settling in **native ETH** (testnet decision A1 —
no ERC-20 approve flow, mirrors the original native-XLM behaviour).

| Contract | Soroban origin | Notes |
|----------|----------------|-------|
| `PalengkePayment.sol` | `palengke-payment` | Pass-through pay; full amount to vendor, no fee skim |
| `VendorRegistry.sol` | `vendor-registry` | Apply→approve, ratings, default mirror; `AccessControl` |
| `UTangEscrow.sol` | `utang-escrow` | BNPL; 1% reserve in contract custody, 5% late fee, `nonReentrant` |

## Prerequisites

Foundry is **not installed** in this repo. Install it first:

```bash
# macOS / Linux / WSL
curl -L https://foundry.paradigm.xyz | bash && foundryup
# Windows (PowerShell): use WSL, or scoop/winget per Foundry docs
```

## Setup

```bash
cd contracts-evm
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
forge build
```

## Test

```bash
forge test -vvv
forge coverage          # target: match/exceed the 19 Rust tests; push toward ~40
```

> Tests under `test/*.t.sol` are starter suites covering the core happy/revert paths.
> They have **not** been run here (Foundry absent) — run `forge test` to validate before
> trusting them. Expand to full edge-case parity with the Rust `test.rs` suites.

## Deploy (Morph Holesky)

```bash
cp .env.example .env   # fill DEPLOYER_KEY + ADMIN_ADDRESS
source .env
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$MORPH_HOLESKY_RPC" --broadcast \
  --verify --verifier blockscout \
  --verifier-url https://explorer-holesky.morphl2.io/api
```

Copy the three printed addresses into `frontend/.env.local` (see root `MIGRATION-STATUS.md`).

## Native-ETH money flow (read before integrating)

- `pay(vendor, memo)` is **payable**; `amount == msg.value`.
- `payInstallment(utangId)` is **payable**; `msg.value` MUST equal `payAmount + reserveFee`
  (reserve = 1% of the installment). Reserve stays in the contract until completion (refunded
  to customer) or default (paid to vendor).
- `resumeAfterLate(utangId)` is **payable**; `msg.value` MUST equal the late fee (5% of an
  installment), forwarded to the vendor.
- `createUtang(...)` is **non-payable** — no funds collected at creation, matching Soroban.
