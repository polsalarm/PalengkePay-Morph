import { formatEther } from 'viem';
import { publicClient } from './config';
import { PAYMENT_ADDRESS } from './chain';
import { palengkePaymentAbi } from './abis/palengkePayment';

// EVM payment indexer. Reads PalengkePayment `PaymentCompleted` logs via the public
// client (the contract is the source of truth — every payment emits one). Caches in
// localStorage for instant first paint, same as the old Horizon indexer.
//
// NOTE: `amountXlm` is retained as the field name for call-site compatibility, but it
// now carries an ETH value (native gas token on Morph). Treat it as "amount".

export interface IndexedPayment {
  id: string;
  from: string;
  to: string;
  amountXlm: number; // ETH amount (field name kept for compatibility)
  createdAt: string;
  memo?: string;
}

interface IndexStore {
  address: string;
  payments: IndexedPayment[];
  syncedAt: string;
}

const PREFIX = 'pp_idx_';
const storageKey = (address: string) => PREFIX + address;

function loadStore(address: string): IndexStore {
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (raw) return JSON.parse(raw) as IndexStore;
  } catch { /* ignore */ }
  return { address, payments: [], syncedAt: '' };
}

function saveStore(store: IndexStore) {
  try {
    localStorage.setItem(storageKey(store.address), JSON.stringify(store));
  } catch { /* storage full — skip */ }
}

interface PaymentEventArgs {
  paymentId?: bigint;
  customer?: string;
  vendor?: string;
  amount?: bigint;
  timestamp?: bigint;
  memo?: string;
}

// Morph RPC caps eth_getLogs at 5000 blocks, so scan in chunks from the deploy block.
// VITE_DEPLOY_BLOCK lets you pin the contracts' deploy height (avoids scanning from 0).
const MAX_RANGE = 5000n;
const DEPLOY_BLOCK = BigInt(import.meta.env.VITE_DEPLOY_BLOCK ?? 5_703_000);

async function getPaymentLogs(args: { customer?: `0x${string}`; vendor?: `0x${string}` }) {
  const latest = await publicClient.getBlockNumber();
  const start = DEPLOY_BLOCK > latest ? 0n : DEPLOY_BLOCK;
  const out: Awaited<ReturnType<typeof publicClient.getContractEvents>> = [];
  for (let from = start; from <= latest; from += MAX_RANGE) {
    const to = from + MAX_RANGE - 1n > latest ? latest : from + MAX_RANGE - 1n;
    const logs = await publicClient.getContractEvents({
      address: PAYMENT_ADDRESS,
      abi: palengkePaymentAbi,
      eventName: 'PaymentCompleted',
      args,
      fromBlock: from,
      toBlock: to,
    });
    out.push(...logs);
  }
  return out;
}

async function fetchPaymentEvents(address: string): Promise<IndexedPayment[]> {
  if (!PAYMENT_ADDRESS) return [];
  const addr = address as `0x${string}`;

  // Two scans: payments sent (customer) and received (vendor). Both args are indexed.
  const [sent, received] = await Promise.all([
    getPaymentLogs({ customer: addr }),
    getPaymentLogs({ vendor: addr }),
  ]);

  const byId = new Map<string, IndexedPayment>();
  for (const log of [...sent, ...received]) {
    const a = (log as unknown as { args: PaymentEventArgs }).args;
    const id = `${log.transactionHash}:${a.paymentId ?? 0n}`;
    byId.set(id, {
      id,
      from: a.customer ?? '',
      to: a.vendor ?? '',
      amountXlm: a.amount ? Number(formatEther(a.amount)) : 0,
      createdAt: new Date(Number(a.timestamp ?? 0n) * 1000).toISOString(),
      memo: a.memo || undefined,
    });
  }
  return Array.from(byId.values());
}

/** Sync payments for address from chain logs. Returns merged sorted list (newest first). */
export async function syncPayments(address: string): Promise<IndexedPayment[]> {
  const store = loadStore(address);
  let fresh: IndexedPayment[];
  try {
    fresh = await fetchPaymentEvents(address);
  } catch {
    return [...store.payments].reverse(); // network/RPC error — serve cache
  }
  if (fresh.length === 0 && store.payments.length > 0) return [...store.payments].reverse();

  const merged = new Map(store.payments.map((p) => [p.id, p]));
  for (const p of fresh) merged.set(p.id, p);
  const sorted = Array.from(merged.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  saveStore({ address, payments: sorted, syncedAt: new Date().toISOString() });
  return [...sorted].reverse();
}

/** Read cached payments without a network call. Newest first. */
export function getCachedPayments(address: string): IndexedPayment[] {
  return [...loadStore(address).payments].reverse();
}

/** Clear index for address (e.g. on wallet disconnect). */
export function clearIndex(address: string) {
  localStorage.removeItem(storageKey(address));
}
