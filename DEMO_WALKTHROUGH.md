# PalengkePay (Morph) — demo walkthrough

End-to-end manual smoke test of **connect → pay → utang** against the live Morph Hoodi
contracts. ~10 minutes.

## Live contracts (Morph Hoodi, chain 2910)
| Contract | Address |
|----------|---------|
| PalengkePayment | `0x49cfc8687afb94a2d3867713a7de829dc21794ca` |
| VendorRegistry | `0xa1aba560607d756096f28f35c5127ce3a05f3032` |
| UTangEscrow | `0x0db57bc80d2687137b7b0fb434bdb1c93b6ea229` |

Explorer: https://explorer-hoodi.morph.network · RPC `https://rpc-hoodi.morph.network`
Admin (`ADMIN_ROLE`): `0x5f1cbCCE2D20D881573297949b4bb01f86DcfC76`

## 0. Prerequisites

1. **MetaMask** (browser extension). Add Morph Hoodi:
   - Network name: `Morph Hoodi` · RPC `https://rpc-hoodi.morph.network` · Chain ID `2910`
   - Symbol `ETH` · Explorer `https://explorer-hoodi.morph.network`
2. **Fund the account** — paste your address at `https://morph-rails-hoodi.morph.network/faucet`
   (drops ETH directly on L2, no bridge). ~0.01 ETH is plenty.
3. **Run the app:** `cd frontend && npm run dev` → http://localhost:5173

> To act as **admin** (approve vendors, mark defaults), import the admin key
> `0x3160…a950a` into MetaMask. For a pure customer/vendor demo you don't need it.

## 1. Connect

1. Open http://localhost:5173 → **Connect** (Landing or /connect).
2. RainbowKit modal → MetaMask → approve. Confirm you're on **Morph Hoodi**.
3. App routes you to /onboard or /customer/home. Balance shows your ETH.

## 2. Become a vendor

**Path A — self-apply + admin approve (full flow):**
1. As a vendor wallet: go to `/vendor/apply`, fill the stall form, submit
   (`VendorRegistry.applyVendor`, your wallet signs).
2. Switch to the **admin** wallet → `/admin/market` (pending list) → **Approve**
   (`approveVendor`). Vendor is now registered + active.

**Path B — admin direct-register (fast):**
1. As admin: `/admin/register` → enter the vendor's `0x` address + stall details →
   submit (`registerVendor`). Done, no vendor-side action.

## 3. Pay a vendor (core flow)

1. As a **customer**: `/customer/scan`. Either scan the vendor's QR (`/vendor/qr`) or
   enter the vendor address + amount manually.
2. Confirm → MetaMask signs `PalengkePayment.pay{value}` (ETH goes straight to the vendor,
   payment recorded on-chain).
3. You land on the **receipt** (`/receipt/:txHash`) — amount, vendor, explorer link.
   Vendor sees it in `/vendor/home` + `/vendor/transactions` (30s poll).
4. Optionally rate the vendor (1–5 ★) → `VendorRegistry.submitRating`.

## 4. Utang (BNPL installments)

1. **Vendor** (`/vendor/utang`): New agreement → amount, # installments, interval,
   description → pay the small service fee → a **QR offer** is generated.
2. **Customer** (`/customer/scan`): scan the utang QR → review terms → confirm
   `UTangEscrow.createUtang` (no funds yet; customer = msg.sender).
3. **Customer** (`/customer/utang`): **Pay installment** → MetaMask signs
   `payInstallment{value = installment + 1% reserve}`. Repeat per period.
4. On the final installment the contract refunds the accumulated reserve to the customer
   and marks the utang **Completed**. Vendor sees it in `/vendor/utang`.
5. (Admin) overdue past grace → `/admin/utang` **Mark default** (reserve → vendor).
   Customer can `resumeAfterLate` (5% fee) to reactivate.

## 5. Verify on-chain
Every action is a real tx — open it on `https://explorer-hoodi.morph.network/tx/<hash>`
(contracts are source-verified, so you can read state in the explorer too).

## Notes
- Cash-in/out (fiat ramp) was **removed** — Morph has no Stellar-style anchor. This is a
  pure crypto-ETH payment + BNPL app.
- Mobile wallets work via WalletConnect (set `VITE_WALLETCONNECT_PROJECT_ID`).
- To pre-populate demo data (vendors, payments, a utang), run `frontend/scripts/seed.mjs`
  (see its header).
