import { formatEther } from 'viem';
import { getVendorPayments, getCustomerPayments } from './contracts';
import { getPaymentContractId } from './payment-routing';
import type { IndexedPayment } from './indexer';
import type { StableCheckoutQuote } from './checkout-quote';

// Rounding factor for amount fingerprints/averages (kept at 1e7 — 7 dp is plenty
// for display). Amounts are ETH; field names retain the *Eth suffix for compat.
const STROOPS_PER_ETH = 10_000_000;

export type PaymentHistorySource = 'palengke-payment' | 'fee-bump';

export interface PaymentHistoryRecord {
  id: string;
  paymentId?: number;
  txHash?: string;
  from: string;
  to: string;
  amountEth: number;
  createdAt: string;
  memo?: string;
  source: PaymentHistorySource;
  quote?: StableCheckoutQuote;
}

export interface ContractPaymentPayload {
  id: number | string | bigint;
  customer: string;
  vendor: string;
  amount: number | string | bigint;
  timestamp: number | string | bigint;
  memo?: string;
}

export interface MetricVendor {
  wallet: string;
  name: string;
  stallNumber: string;
  productType: string;
  isActive: boolean;
}

export interface MetricSummary {
  totalVendors: number;
  activeVendors: number;
  pendingVendors: number;
  totalVolumeEth: number;
  totalTransactions: number;
  avgTxEth: number;
}

export interface ProductBreakdown {
  type: string;
  count: number;
  volumeEth: number;
  pct: number;
}

export interface TopVendor {
  wallet?: string;
  name: string;
  stallNumber: string;
  productType: string;
  totalTransactions: number;
  volumeEth: number;
}

export interface PaymentMetrics {
  summary: MetricSummary;
  productBreakdown: ProductBreakdown[];
  topVendors: TopVendor[];
}

export function normalizeContractPayment(payment: ContractPaymentPayload): PaymentHistoryRecord {
  const paymentId = Number(payment.id);
  return {
    id: `palengke-payment:${paymentId}`,
    paymentId,
    from: String(payment.customer),
    to: String(payment.vendor),
    amountEth: Number(formatEther(BigInt(payment.amount))),
    createdAt: new Date(Number(BigInt(payment.timestamp)) * 1000).toISOString(),
    memo: payment.memo ? String(payment.memo) : undefined,
    source: 'palengke-payment',
  };
}

export function normalizeFallbackPayment(payment: IndexedPayment): PaymentHistoryRecord {
  return {
    id: `horizon:${payment.id}`,
    txHash: payment.id,
    from: payment.from,
    to: payment.to,
    amountEth: payment.amountEth,
    createdAt: payment.createdAt,
    memo: payment.memo,
    source: 'fee-bump',
  };
}

export function mergePaymentHistory(
  contractPayments: PaymentHistoryRecord[],
  fallbackPayments: PaymentHistoryRecord[],
): PaymentHistoryRecord[] {
  const fingerprints = new Set(contractPayments.map(paymentFingerprint));
  const merged = [
    ...contractPayments,
    ...fallbackPayments.filter((payment) => !fingerprints.has(paymentFingerprint(payment))),
  ];

  return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function buildPaymentMetrics(
  vendors: MetricVendor[],
  payments: PaymentHistoryRecord[],
  pendingVendors: number,
): PaymentMetrics {
  const paymentTotals = new Map<string, { totalTransactions: number; volumeEth: number }>();
  for (const payment of payments) {
    const existing = paymentTotals.get(payment.to) ?? { totalTransactions: 0, volumeEth: 0 };
    paymentTotals.set(payment.to, {
      totalTransactions: existing.totalTransactions + 1,
      volumeEth: existing.volumeEth + payment.amountEth,
    });
  }

  const active = vendors.filter((vendor) => vendor.isActive);
  const totalVolumeEth = payments.reduce((sum, payment) => sum + payment.amountEth, 0);
  const totalTransactions = payments.length;
  const summary: MetricSummary = {
    totalVendors: vendors.length,
    activeVendors: active.length,
    pendingVendors,
    totalVolumeEth,
    totalTransactions,
    avgTxEth: totalTransactions > 0 ? roundEth(totalVolumeEth / totalTransactions) : 0,
  };

  const productMap = new Map<string, { count: number; volumeEth: number }>();
  for (const vendor of vendors) {
    const type = vendor.productType || 'other';
    const existing = productMap.get(type) ?? { count: 0, volumeEth: 0 };
    productMap.set(type, {
      count: existing.count + 1,
      volumeEth: existing.volumeEth + (paymentTotals.get(vendor.wallet)?.volumeEth ?? 0),
    });
  }

  const total = vendors.length || 1;
  const productBreakdown = Array.from(productMap.entries())
    .map(([type, { count, volumeEth }]) => ({
      type,
      count,
      volumeEth,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const topVendors = vendors
    .filter((vendor) => vendor.isActive)
    .map((vendor) => ({
      name: vendor.name,
      wallet: vendor.wallet,
      stallNumber: vendor.stallNumber,
      productType: vendor.productType,
      totalTransactions: paymentTotals.get(vendor.wallet)?.totalTransactions ?? 0,
      volumeEth: paymentTotals.get(vendor.wallet)?.volumeEth ?? 0,
    }))
    .sort((a, b) => b.volumeEth - a.volumeEth)
    .slice(0, 5);

  return { summary, productBreakdown, topVendors };
}

export function hasPaymentContractSource(): boolean {
  return !!getPaymentContractId()?.trim();
}

export async function fetchVendorContractPayments(vendorWallet: string): Promise<PaymentHistoryRecord[]> {
  if (!hasPaymentContractSource()) return [];
  const raw = await getVendorPayments(vendorWallet);
  return raw.map(normalizeContractPayment);
}

export async function fetchCustomerContractPayments(customerWallet: string): Promise<PaymentHistoryRecord[]> {
  if (!hasPaymentContractSource()) return [];
  const raw = await getCustomerPayments(customerWallet);
  return raw.map(normalizeContractPayment);
}

export async function fetchContractPaymentsForVendors(vendors: MetricVendor[]): Promise<PaymentHistoryRecord[]> {
  const batches = await Promise.all(vendors.map((vendor) => fetchVendorContractPayments(vendor.wallet)));
  const byId = new Map<string, PaymentHistoryRecord>();
  for (const payment of batches.flat()) {
    byId.set(payment.id, payment);
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function paymentFingerprint(payment: PaymentHistoryRecord): string {
  return [
    payment.from,
    payment.to,
    payment.amountEth.toFixed(7),
    payment.createdAt,
    payment.memo ?? '',
  ].join('|');
}

function roundEth(value: number): number {
  return Math.round(value * STROOPS_PER_ETH) / STROOPS_PER_ETH;
}
