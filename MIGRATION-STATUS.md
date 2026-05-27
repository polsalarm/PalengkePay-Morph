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

### Phase 2 — deploy to Morph Hoodi ✅ (2026-05-27, chain 2910)
Deployed all three contracts to Morph Hoodi testnet via `forge script`. Holesky (2810)
was dead — Ethereum sunset it Sept 2025, Morph moved to Hoodi + `morph.network` domain.

| Contract | Address |
| --- | --- |
| PalengkePayment | `0x49cfc8687afb94a2d3867713a7de829dc21794ca` |
| VendorRegistry  | `0xa1aba560607d756096f28f35c5127ce3a05f3032` |
| UTangEscrow     | `0x0db57bc80d2687137b7b0fb434bdb1c93b6ea229` |

- Admin (ADMIN_ROLE on registry + escrow): `0x5f1cbCCE2D20D881573297949b4bb01f86DcfC76`
  (disposable testnet EOA). Verified on-chain: `escrow.gracePeriod()==604800`,
  `hasRole(ADMIN_ROLE, admin)==true` on both.
- Explorer: https://explorer-hoodi.morph.network/address/0x49cfc8687afb94a2d3867713a7de829dc21794ca (etc).
- Addresses written to `frontend/.env.local` (gitignored) as `VITE_*_ADDRESS`, plus
  `VITE_CHAIN_ID=2910`, RPC, explorer.
- **Gotcha for redeploys:** Morph Hoodi sequencer floor gas is ~0.2 gwei but forge's
  EIP-1559 estimate off the 0.001 gwei base fee produced 0.0025 gwei txs that hung
  pending forever. Deploy with `--legacy --with-gas-price 1000000000 --slow`.
- **TODO:** Blockscout source verification still pending — `--verify --verifier
  blockscout --verifier-url .../api` returned 404; needs the correct Hoodi Blockscout
  verification endpoint. Non-blocking for the frontend.

## Decisions taken (plan §8) — confirm or override

- **A. Gas/currency → A1: native ETH** on testnet (no approve flow). Contracts are
  payable; reserve/late-fee math uses `msg.value`. Revisit A3 (Privy/gasless) only if
  Morph mainnet happens.
- **D. Naming → `PalengkePay Morph`** folder, suggest Vercel `palengkepay-morph`.

Still open: **B** (SIWE vs no auth), **C** (indexer: viem `getLogs` vs Goldsky).
Defaults (B1/C1) assumed unless you say otherwise.

## Not started (next phases)

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
