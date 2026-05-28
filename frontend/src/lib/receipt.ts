import { formatEther, parseEventLogs } from 'viem';
import { publicClient } from './config';
import { explorerTxUrl } from './evm';
import { getVendor } from './contracts';
import { palengkePaymentAbi } from './abis/palengkePayment';

export interface ReceiptVendor {
  name: string;
  stallNumber: string;
  productType: string;
}

export interface Receipt {
  txHash: string;
  from: string;
  to: string;
  amountEth: string; // ETH amount (field name kept for compatibility)
  memo: string | null;
  createdAt: string;
  feeChargedEth: string; // gas fee in ETH
  vendor: ReceiptVendor | null;
  stellarExpertUrl: string; // Morph explorer tx URL (field name kept for compatibility)
}

async function fetchVendor(address: string): Promise<ReceiptVendor | null> {
  const v = await getVendor(address).catch(() => null);
  if (!v) return null;
  return { name: v.name, stallNumber: v.stallNumber, productType: v.productType };
}

interface PaymentEventArgs {
  customer?: string;
  vendor?: string;
  amount?: bigint;
  timestamp?: bigint;
  memo?: string;
}

export async function fetchReceipt(txHash: string): Promise<Receipt> {
  const hash = txHash as `0x${string}`;
  const [receipt, tx] = await Promise.all([
    publicClient.getTransactionReceipt({ hash }),
    publicClient.getTransaction({ hash }),
  ]);

  const events = parseEventLogs({
    abi: palengkePaymentAbi,
    eventName: 'PaymentCompleted',
    logs: receipt.logs,
  });
  const ev = (events[0]?.args ?? undefined) as PaymentEventArgs | undefined;

  const from = ev?.customer ?? tx.from;
  const to = ev?.vendor ?? '';
  const amountEth = ev?.amount != null ? formatEther(ev.amount) : formatEther(tx.value);
  const memo = ev?.memo || null;

  let createdAt: string;
  if (ev?.timestamp) {
    createdAt = new Date(Number(ev.timestamp) * 1000).toISOString();
  } else {
    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    createdAt = new Date(Number(block.timestamp) * 1000).toISOString();
  }

  const feeWei = receipt.gasUsed * receipt.effectiveGasPrice;
  const vendor = to ? await fetchVendor(to) : null;

  return {
    txHash: hash,
    from,
    to,
    amountEth: amountEth,
    memo,
    createdAt,
    feeChargedEth: formatEther(feeWei),
    vendor,
    stellarExpertUrl: explorerTxUrl(hash),
  };
}

export function receiptUrl(txHash: string): string {
  if (typeof window === 'undefined') return `/receipt/${txHash}`;
  return `${window.location.origin}/receipt/${txHash}`;
}

export async function shareReceipt(txHash: string, vendorName?: string, amountEth?: string): Promise<'shared' | 'copied'> {
  const url = receiptUrl(txHash);
  const title = 'PalengkePay Receipt';
  const text = vendorName && amountEth
    ? `Payment of ${amountEth} ETH to ${vendorName} — verified on Morph.`
    : 'Verified on-chain payment receipt.';

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (err) {
      const aborted = (err as { name?: string }).name === 'AbortError';
      if (aborted) throw err;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return 'copied';
  }

  throw new Error('Sharing not supported on this device.');
}
