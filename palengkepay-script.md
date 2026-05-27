# PalengkePay — Speaker Script

Talking script to pair with `palengkepay-deck.html`. Conversational — read it, don't memorize it. Time estimate: ~12–15 min. Feel free to switch to Taglish where it lands better.

**Controls reminder:** `→` / `space` next · `←` back · `f` fullscreen · on the demo slide, `space` plays/pauses the video. Slide 7 reveals one answer per click.

---

## Slide 1 — Who am I
Hi everyone, kumusta. I'm Paul Dacalan. I'm a 3rd-year BS Computer Science student at FEU Institute of Technology, specializing in Software Engineering. I'm also a Stellar Philippines Ambassador. Quick version of what that means: I build on Stellar end to end — from the smart contract all the way to the app in someone's hand — and part of my job is to help more Filipinos start building too. That's literally what today is.

## Slide 2 — Why I'm teaching full-stack
Why full-stack, and why me? Three reasons. First: when you understand every layer — contract, frontend, deploy — you can ship a real product by yourself. You're not stuck waiting on a teammate. Second: Web3 in the Philippines right now is mostly trading. I'd rather we grow people who *build* things for Filipinos. Third, and most important: it's learnable. I'm a student. If I can wire a smart contract to a vendor's phone, you can too. Full-stack isn't knowing everything — it's being able to follow one idea all the way down.

## Slide 3 — How I build a full-stack project
So let's get into it: how do I actually build a full-stack project? Here's the thing — before I write a single line of code, I answer six questions. It's the same framework a journalist uses to tell a story.

## Slide 4 — The 5 W's & 1 H
The 5 W's and 1 H. Who is it for. What does it do. When does it run. Where does it live. Why should it exist. And how is it built. Answer these *first*. This is what stops you from building the wrong thing beautifully — which is the most expensive mistake you can make.

## Slide 5 — Demo (video)
Before I tell you the answers, let me show you the thing working. This is PalengkePay.
> **Cue:** press `space` to play. Press `space` again to pause. Use the `10s` buttons to skip if you're short on time. Narrate over it — point out the QR scan, the payment confirming in seconds, and the utang screen.

## Slide 6 — Your turn
Okay — you just watched it work. So you tell me: what were the 5 W's and 1 H behind PalengkePay? Who's it for, what does it do, when and where does it run, why does it need to exist, and how is it built? Take a guess.
> **Cue:** let the audience answer out loud before moving on.

## Slide 7 — The answer (click to reveal)
Here's how I scoped it.
> **Cue:** click once per answer.
- **Who** — palengke vendors and their customers, plus the market admins who onboard them. Mostly unbanked, cash-only.
- **What** — QR micropayments and *utang*, buy-now-pay-later, that settle on Stellar. Every transaction quietly builds the vendor a financial identity.
- **When** — real-time. Payments confirm in seconds. Utang runs on a weekly installment schedule with a grace period.
- **Where** — in the palengke, on a cheap phone, as an installable web app. Money lives on-chain; profiles stay off-chain.
- **Why** — fintech treats these vendors as invisible. No merchant account, card fees eat their margins. They deserve a zero-barrier way in.
- **How** — three smart contracts in Rust, a React app, wallets through Stellar Wallets Kit, and it's gasless for the vendor. That "how" is the rest of this talk.

## Slide 8 — How I created it
Here's the whole pipeline. Plan with the six questions. Write the contracts in Rust. Deploy them to Testnet and verify on Stellar Expert. Generate TypeScript clients from those contracts. Build the frontend — React, Vite, a PWA. Then ship it on Vercel. One rule of thumb keeps the whole thing clean: money logic goes on-chain, profile data goes off-chain, and anything like QR scanning stays in the browser.

## Slide 9 — Project structure
This is the repo. Notice the split: contracts in Rust, frontend in TypeScript, and there's no backend server. The app talks straight to the smart contracts and to a few serverless functions. Three contracts — vendor-registry, palengke-payment, utang-escrow. The frontend is organized by who's using it: vendor, customer, admin.

## Slide 10 — Smart contracts on Soroban
Let's talk smart contracts. Soroban is Stellar's smart-contract platform — you write them in Rust, they compile to WASM. The contracts hold the money logic. Anything that touches value lives here, where it's verifiable and can't be quietly changed. PalengkePay has three: VendorRegistry handles identity, PalengkePayment handles settlement, and UTangEscrow handles the credit. Each one starts with `initialize`, guards its sensitive calls with `require_auth`, and can be upgraded without losing its data.

## Slide 11 — VendorRegistry functions
First contract — VendorRegistry. This is identity. On the left, onboarding: a vendor applies, the admin approves or rejects, then registers them. The middle is profile and stats — `increment_stats` is the one that quietly builds their transaction history. And on the right, reputation: customers submit ratings, and there's even default tracking, so a vendor's reliability is on-chain too.

## Slide 12 — PalengkePayment functions
Second contract — PalengkePayment. This is the heart of the app, and honestly it comes down to one function: `pay`. Customer, vendor, amount, memo. The customer signs, it moves the full amount straight to the vendor, stores a Payment record, and fires an event. Everything else is setup — `initialize`, `set_token`, `upgrade` — and reads for the dashboards to pull payment history.

## Slide 13 — UTangEscrow functions
Third contract — UTangEscrow. This is the credit layer, the *utang*. Lifecycle on the left: create the utang, pay each installment, check if it's overdue, mark a default, or resume after a late payment. Config in the middle — the admin sets the max amount and the grace period. And the reads track defaults for both sides. The key part: it ships with a 7-day grace period, a 1% reserve pool, and a 5% late fee. That credit logic is enforced by the contract — not by a server I could tamper with.

## Slide 14 — Contracts & wallets together
Here's the piece people get wrong. The contract never trusts the frontend. It trusts a *signature*. The flow: the app builds the call, the wallet asks the user to sign — and the private key never leaves their device — then we simulate and submit through the RPC, and the contract runs only if `require_auth` passes. Two things make this nice for real users: Stellar Wallets Kit lets us support Freighter, Lobstr, xBull, all behind one API. And a sponsor wallet fee-bumps the transaction, so the vendor pays nothing to receive money.

## Slide 15 — Frontend & why TypeScript
Now the frontend. Which framework? Honestly it depends — React, Vue, Svelte all work, that's a preference. But the *language* is not a preference. Use TypeScript. The big reason: the Stellar SDK is TypeScript-native, and the CLI generates a fully-typed client straight from your deployed contract. So if you pass the wrong argument, it fails at compile time — in your editor — before it ever costs you real XLM. On a money app, that safety net is everything.

## Slide 16 — Connecting frontend to contracts
So how do you actually wire it up? Four steps. One: save each contract ID in an env var — never hard-code it. Two: run the CLI once per deploy to generate a typed client. Three: create that client with three things — the contract ID, the RPC URL, and the network. Four: call a function, the wallet signs it, you send it, you read the result. That's it — the code on the right is the whole thing.
> **Cue:** one warning worth saying out loud — every time you redeploy, you get a *new* contract ID. Update your env and Vercel, or your app talks to the old contract.

## Slide 17 — Final message
So that's the whole stack, from Rust to a vendor's phone. The one thing I want you to leave with: you don't need permission to start building. Plan it, build it, ship it. Pick one idea and follow it all the way down. Salamat — now go build on Stellar.
> **Cue:** thank them, mention you're a Stellar PH Ambassador if anyone wants to get involved, open for Q&A.

---

# Function deep-dive (for slides 11–13)

Talk these through on the contract slides. You don't need every function — these are the main ones that tell the story. All explanations match the deployed code.

## VendorRegistry — identity (slide 11)

- **`apply_vendor`** — A vendor signs up *themselves*. They submit their stall info — name, stall number, market, product, phone. It lands in a *pending* list; they're not live yet. Their own wallet has to sign, so no one can apply on their behalf.
- **`approve_vendor`** — Admin-only. Takes a pending application and turns it into a real, registered vendor on-chain. (`reject_vendor` does the opposite.)
- **`increment_stats`** — Bumps a vendor's transaction count and total volume. This is what slowly builds their on-chain track record — the financial identity the banks never gave them. Admin-gated, so the numbers can't be faked.
- **`submit_rating`** — A customer rates a vendor 1–5 stars, tied to one transaction hash so each transaction can only be rated once. Builds public reputation. *Honest note:* this version trusts the customer — it doesn't yet verify the payment actually happened. That's a planned hardening, good to mention if asked.
- **`get_vendor`** — Plain read: give it a wallet, get back that vendor's record. This is what the app calls to show a profile.

## PalengkePayment — settlement (slide 12)

- **`initialize`** — Run once at deploy. Sets the admin and which token payments use (native XLM).
- **`pay`** — The whole point. The customer signs, and it transfers the **full** amount straight from customer to vendor in one call, saves a Payment record (id, who, how much, memo, timestamp), and emits a `PaymentCompleted` event the dashboards listen for. Settles in seconds. *(No fee is skimmed — a fee setting exists for the future but isn't deducted today. Say "full amount" so you're accurate.)*
- **`get_vendor_payments`** — Returns a vendor's payment history, paginated. This fills the vendor's transactions screen.

## UTangEscrow — credit / utang (slide 13)

- **`create_utang`** — Sets up a buy-now-pay-later plan. The customer signs and agrees on total, number of installments, and interval (e.g. weekly). The contract splits it into equal installments and sets the first due date. There's a cap on the total so it stays small and safe.
- **`pay_installment`** — Customer pays one installment; the vendor receives it immediately. A small 1% slice is held by the contract as a reserve. Finish the plan cleanly and that reserve is **refunded to the customer**. The final installment auto-pays whatever's left, so the math always closes.
- **`mark_default`** — Admin-only, and only *after* the 7-day grace period passes. It flips the utang to Defaulted, pays the held reserve to the vendor as partial compensation, and records the default against both customer and vendor history.
- **`resume_after_late`** — The second chance. A customer who defaulted can pay a 5% late fee — straight to the vendor — to reactivate the plan and get a fresh due date.
