import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyMessage, isAddress } from 'viem';
import { getStatus, getStatuses, setStatus } from './_statusStore.js';

// Vendor open/closed status, proven by an EIP-191 personal_sign (no on-chain tx).
// The client signs the message built by lib/vendorStatus.buildSetStatusMessage and
// posts { address, message, signature }; we verify with viem and store the flag.
const REPLAY_WINDOW_SECONDS = 600;

function publicStatus(rec: { isOpen: boolean; updatedAt: number } | null) {
  return rec
    ? { isOpen: rec.isOpen, defaulted: false, updatedAt: rec.updatedAt }
    : { isOpen: true, defaulted: true };
}

function parseStatusMessage(message: string): { vendor: string; isOpen: boolean; issued: number } | null {
  const lines = message.split('\n').map((l) => l.trim());
  if (lines[0] !== 'PalengkePay vendor status update') return null;
  const get = (prefix: string) => lines.find((l) => l.startsWith(prefix))?.slice(prefix.length).trim();
  const vendor = get('Vendor:');
  const status = get('Status:');
  const issuedStr = get('Issued:');
  if (!vendor || !status || !issuedStr) return null;
  if (status !== 'open' && status !== 'closed') return null;
  const issued = Date.parse(issuedStr);
  if (!Number.isFinite(issued)) return null;
  return { vendor, isOpen: status === 'open', issued: Math.floor(issued / 1000) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const raw = (req.query.vendors ?? req.query.vendor) as string | string[] | undefined;
    const flat = Array.isArray(raw) ? raw.join(',') : raw;
    if (!flat) return res.status(400).json({ error: 'vendor required' });
    const list = flat.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return res.status(400).json({ error: 'vendor required' });

    for (const addr of list) {
      if (!isAddress(addr)) return res.status(400).json({ error: `invalid address: ${addr}` });
    }

    if (list.length === 1) {
      const rec = await getStatus(list[0]);
      return res.status(200).json(publicStatus(rec));
    }
    const map = await getStatuses(list);
    const statuses: Record<string, ReturnType<typeof publicStatus>> = {};
    for (const a of list) statuses[a] = publicStatus(map.get(a) ?? null);
    return res.status(200).json({ statuses });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address, message, signature } = (req.body ?? {}) as {
    address?: string; message?: string; signature?: string;
  };
  if (!address || !isAddress(address)) return res.status(400).json({ error: 'valid address required' });
  if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'message required' });
  if (typeof signature !== 'string' || !signature.startsWith('0x')) return res.status(400).json({ error: 'signature required' });

  const parsed = parseStatusMessage(message);
  if (!parsed) return res.status(400).json({ error: 'malformed status message' });
  if (parsed.vendor.toLowerCase() !== address.toLowerCase()) {
    return res.status(400).json({ error: 'message vendor does not match address' });
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.issued) > REPLAY_WINDOW_SECONDS) {
    return res.status(400).json({ error: 'challenge expired' });
  }

  let valid = false;
  try {
    valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) return res.status(400).json({ error: 'signature verification failed' });

  const rec = { isOpen: parsed.isOpen, updatedAt: Date.now() };
  await setStatus(address, rec);
  return res.status(200).json({ ok: true, ...publicStatus(rec) });
}
