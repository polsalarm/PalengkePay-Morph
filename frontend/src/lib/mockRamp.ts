// Mock fiat on/off-ramp for the testnet demo. No real funds move — real ramps can't
// sell/buy valueless testnet ETH, and Transak has no Morph network. This simulates the
// PHP<->ETH cash-in/out UX (rate-based numbers, receipts) so the flow is demoable.
// Receipts are kept in localStorage. Swap for Transak (lib/transak.ts) on a supported
// mainnet chain in production.

export type RampKind = 'cashin' | 'cashout';

export interface MockRampTxn {
  id: string;
  kind: RampKind;
  php: number;
  eth: number;
  rate: number;     // PHP per ETH at time of txn
  at: string;       // ISO
  ref: string;      // mock provider reference
  status: 'completed';
}

const KEY = 'pp_mock_ramp';

function load(): MockRampTxn[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MockRampTxn[]) : [];
  } catch {
    return [];
  }
}

function save(list: MockRampTxn[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50))); } catch { /* quota */ }
}

function ref(): string {
  return 'MOCK-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Record a simulated ramp txn (newest first). Returns the receipt. */
export function recordRamp(kind: RampKind, php: number, eth: number, rate: number): MockRampTxn {
  const txn: MockRampTxn = {
    id: crypto.randomUUID?.() ?? ref(),
    kind, php, eth, rate,
    at: new Date().toISOString(),
    ref: ref(),
    status: 'completed',
  };
  save([txn, ...load()]);
  return txn;
}

export function getMockRamps(): MockRampTxn[] {
  return load();
}
