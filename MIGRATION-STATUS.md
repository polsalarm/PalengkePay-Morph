# PalengkePay → Morph migration — status

Tracks execution of `docs/morph-migration-plan.md`. This repo is the **EVM fork**;
the Stellar original is untouched in the sibling `../PalengkePay Pro`.

## Done

### Phase 0 — Clone & setup ✅
- Sibling clone created (`PalengkePay Morph/`), 484 files. Excluded: `node_modules`,
  `target`, `dist`, `.git`, `.code-review-graph`, `.vercel`, `.vercel-mainnet`,
  test artifacts, and the 220 MB walkthrough `.mp4`.
- Fresh `git init` (no Stellar history).
- Deleted Rust `contracts/` (reference remains in sibling).
- Root `package.json` → name `palengkepay-morph`, dropped `@stellar/stellar-sdk`.

### Phase 1 — Foundry contracts ✅ (compiled + tested, 21/21 passing)
`contracts-evm/` scaffolded with native-ETH Solidity ports + tests + deploy script.
- `src/PalengkePayment.sol`, `src/VendorRegistry.sol`, `src/UTangEscrow.sol`
- `test/*.t.sol` — core happy/revert paths per contract
- `script/Deploy.s.sol`, `foundry.toml`, `remappings.txt`, `.env.example`
- Deps: OpenZeppelin `v5.1.0` + forge-std (in `lib/`, git submodules).
- Foundry lives at `~/.foundry/bin` (forge 1.7.1) — **not on PATH**; call with full
  path or add to PATH. `forge build` clean (2 benign `block.timestamp` lint warnings,
  fine for a 7-day grace). `forge test` → 21 passed, 0 failed.

**Fixes applied during validation:**
- `test/UTangEscrow.t.sol`: 2 starter tests warped to `now + INTERVAL + grace`, but
  `next_due` advances one interval on each paid installment, so the warp landed short
  of `next_due + grace` → not overdue. Now warp to `getUtang(id).next_due + grace + 1`.
  (Test bug, not a contract bug.)
- `src/UTangEscrow.sol`: closed the installment edge case (decision A). `createUtang`
  now reverts `DegenerateInstallmentPlan` when `installmentAmount*(n-1) >= totalAmount`
  (e.g. total=5, n=4), which previously let the final installment underflow and the
  vendor over-collect. Solidity-only fix; the Stellar/Soroban original in the sibling
  `../PalengkePay Pro` was intentionally left untouched.

## Decisions taken (plan §8) — confirm or override

- **A. Gas/currency → A1: native ETH** on testnet (no approve flow). Contracts are
  payable; reserve/late-fee math uses `msg.value`. Revisit A3 (Privy/gasless) only if
  Morph mainnet happens.
- **D. Naming → `PalengkePay Morph`** folder, suggest Vercel `palengkepay-morph`.

Still open: **B** (SIWE vs no auth), **C** (indexer: viem `getLogs` vs Goldsky).
Defaults (B1/C1) assumed unless you say otherwise.

## Not started (next phases)

- **Phase 2** — deploy to Morph Hoodi testnet (chain 2910). **Holesky (2810) is dead:**
  Ethereum Holesky was sunset Sept 2025, Morph moved its testnet to Ethereum Hoodi, and
  the `morphl2.io` domain moved to `morph.network`. Capture 3 addresses to
  `frontend/.env.local`:
  ```
  VITE_PALENGKE_PAYMENT_ADDRESS=0x...
  VITE_VENDOR_REGISTRY_ADDRESS=0x...
  VITE_UTANG_ESCROW_ADDRESS=0x...
  VITE_CHAIN_ID=2910
  VITE_MORPH_RPC_URL=https://rpc-hoodi.morph.network
  VITE_MORPH_EXPLORER=https://explorer-hoodi.morph.network
  VITE_WALLETCONNECT_PROJECT_ID=...
  ```
- **Phase 3** — frontend wallet swap (wagmi + RainbowKit). `frontend/` is still the
  **untouched Stellar code** — left intact as the porting reference. Deps not yet swapped.
- **Phase 4–6** — contract hooks, proof/recovery, API route rewrites.
- **Phase 7–9** — E2E, Vercel deploy, buffer.

## Notable port deviations from the Soroban originals
- Payment contract drops `set_token`/`fee_bps`/`upgrade` (native ETH, no token addr;
  redeploy instead of upgrade on testnet).
- Escrow `payInstallment`/`resumeAfterLate` require **exact** `msg.value`; reserve is held
  as native ETH in the contract.
- `Ownable`/`require_auth` → OpenZeppelin `AccessControl` (`ADMIN_ROLE`) on registry+escrow.
- Pagination arg order kept as Soroban `(limit, offset)`.
