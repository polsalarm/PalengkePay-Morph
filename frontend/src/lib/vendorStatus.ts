const STATUS_ENDPOINT = (import.meta.env.VITE_VENDOR_STATUS_URL as string | undefined) ?? '/api/vendor-status';

export interface VendorStatus {
  isOpen: boolean;
  /** True when no off-chain status record exists — vendor never toggled. */
  defaulted: boolean;
  updatedAt?: number;
}

function randomNonce(): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  // base64url, 12 chars
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function fetchVendorStatus(address: string): Promise<VendorStatus> {
  try {
    const res = await fetch(`${STATUS_ENDPOINT}?vendor=${encodeURIComponent(address)}`);
    if (!res.ok) return { isOpen: true, defaulted: true };
    const body = await res.json() as VendorStatus;
    return body;
  } catch {
    return { isOpen: true, defaulted: true };
  }
}

export async function fetchVendorStatuses(addresses: string[]): Promise<Map<string, VendorStatus>> {
  const out = new Map<string, VendorStatus>();
  if (addresses.length === 0) return out;
  try {
    const qs = encodeURIComponent(addresses.join(','));
    const res = await fetch(`${STATUS_ENDPOINT}?vendors=${qs}`);
    if (!res.ok) {
      for (const a of addresses) out.set(a, { isOpen: true, defaulted: true });
      return out;
    }
    const body = await res.json() as { statuses?: Record<string, VendorStatus>; isOpen?: boolean; defaulted?: boolean };
    if (body.statuses) {
      for (const [a, s] of Object.entries(body.statuses)) out.set(a, s);
    } else if (typeof body.isOpen === 'boolean') {
      // Single-vendor response shape (when only one address was sent)
      out.set(addresses[0], { isOpen: body.isOpen, defaulted: Boolean(body.defaulted) });
    }
    for (const a of addresses) if (!out.has(a)) out.set(a, { isOpen: true, defaulted: true });
    return out;
  } catch {
    for (const a of addresses) out.set(a, { isOpen: true, defaulted: true });
    return out;
  }
}

/**
 * Build the message a vendor signs (EIP-191 personal_sign) to prove ownership of
 * their address and set their open/closed status. The server verifies the
 * signature (viem verifyMessage) — nothing is submitted on-chain. The nonce +
 * timestamp guard against replay.
 */
export function buildSetStatusMessage(vendorAddress: string, isOpen: boolean): string {
  const nonce = randomNonce();
  return [
    'PalengkePay vendor status update',
    `Vendor: ${vendorAddress}`,
    `Status: ${isOpen ? 'open' : 'closed'}`,
    `Nonce: ${nonce}`,
    `Issued: ${new Date().toISOString()}`,
  ].join('\n');
}

export interface SignedStatusPayload {
  address: string;
  message: string;
  signature: string;
}

export async function submitSignedStatus(payload: SignedStatusPayload): Promise<void> {
  const res = await fetch(STATUS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Status update failed' })) as { error?: string };
    throw new Error(body.error ?? 'Status update failed');
  }
}
