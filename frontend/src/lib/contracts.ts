import { parseEther, formatEther, parseUnits } from 'viem';
import { readContractOrNull, writeContract } from './evm';
import { PAYMENT_ADDRESS, REGISTRY_ADDRESS, ESCROW_ADDRESS, contractsDeployed } from './chain';
import { palengkePaymentAbi } from './abis/palengkePayment';
import { erc20Abi } from './abis/erc20';
import { vendorRegistryAbi } from './abis/vendorRegistry';
import { utangEscrowAbi } from './abis/utangEscrow';
import type { PayToken } from './tokens';

export { PAYMENT_ADDRESS, REGISTRY_ADDRESS, ESCROW_ADDRESS, contractsDeployed };

const RESERVE_BPS = 100n; // mirrors UTangEscrow.RESERVE_BPS (1%)
const LATE_FEE_BPS = 500n; // mirrors UTangEscrow.LATE_FEE_BPS (5%)

function requirePayment(): `0x${string}` {
  if (!PAYMENT_ADDRESS) throw new Error('PalengkePayment address not configured (VITE_PALENGKE_PAYMENT_ADDRESS).');
  return PAYMENT_ADDRESS;
}
function requireRegistry(): `0x${string}` {
  if (!REGISTRY_ADDRESS) throw new Error('VendorRegistry address not configured (VITE_VENDOR_REGISTRY_ADDRESS).');
  return REGISTRY_ADDRESS;
}
function requireEscrow(): `0x${string}` {
  if (!ESCROW_ADDRESS) throw new Error('UTangEscrow address not configured (VITE_UTANG_ESCROW_ADDRESS).');
  return ESCROW_ADDRESS;
}

export interface PaymentResult { txHash: string; }

export interface RawPayment {
  id: bigint;
  customer: string;
  vendor: string;
  amount: bigint;
  timestamp: bigint;
  memo: string;
}

export async function getVendorPayments(vendor: string, limit = 100, offset = 0): Promise<RawPayment[]> {
  const raw = await readContractOrNull<RawPayment[]>(requirePayment(), palengkePaymentAbi as never, 'getVendorPayments', [vendor as `0x${string}`, BigInt(limit), BigInt(offset)]);
  return Array.isArray(raw) ? raw : [];
}

export async function getCustomerPayments(customer: string, limit = 100, offset = 0): Promise<RawPayment[]> {
  const raw = await readContractOrNull<RawPayment[]>(requirePayment(), palengkePaymentAbi as never, 'getCustomerPayments', [customer as `0x${string}`, BigInt(limit), BigInt(offset)]);
  return Array.isArray(raw) ? raw : [];
}

// ── PalengkePayment ─────────────────────────────────────────────────────────────

/** Pay `to` the given ETH amount through PalengkePayment (msg.value == amount). */
export async function sendPayment(to: string, amountEth: string, memo: string): Promise<PaymentResult> {
  const txHash = await writeContract({
    address: requirePayment(),
    abi: palengkePaymentAbi as never,
    functionName: 'pay',
    args: [to as `0x${string}`, memo.trim()],
    value: parseEther(amountEth),
  });
  return { txHash };
}

// ── Stablecoin (ERC-20) payments ────────────────────────────────────────────────

/** Current ERC-20 allowance the owner has granted PalengkePayment to spend. */
export async function getTokenAllowance(token: PayToken, owner: string): Promise<bigint> {
  if (!token.address) return 0n;
  const raw = await readContractOrNull<bigint>(token.address, erc20Abi as never, 'allowance', [
    owner as `0x${string}`,
    requirePayment(),
  ]);
  return raw ?? 0n;
}

/** ERC-20 balance of `owner` in raw base units (caller formats with token.decimals). */
export async function getTokenBalance(token: PayToken, owner: string): Promise<bigint> {
  if (!token.address) return 0n;
  const raw = await readContractOrNull<bigint>(token.address, erc20Abi as never, 'balanceOf', [
    owner as `0x${string}`,
  ]);
  return raw ?? 0n;
}

/** Approve PalengkePayment to spend `amount` (base units) of `token`. Waits for receipt. */
export async function approveToken(token: PayToken, amount: bigint): Promise<string> {
  if (!token.address) throw new Error('approveToken called for native ETH');
  return writeContract({
    address: token.address,
    abi: erc20Abi as never,
    functionName: 'approve',
    args: [requirePayment(), amount],
  });
}

/** Mint testnet mock tokens to the caller via the public faucet. Waits for receipt. */
export async function faucetToken(token: PayToken): Promise<string> {
  if (!token.address) throw new Error('faucet called for native ETH');
  return writeContract({
    address: token.address,
    abi: erc20Abi as never,
    functionName: 'faucet',
    args: [],
  });
}

/**
 * Pay `to` `amount` (human decimal string) of an ERC-20 `token` through
 * PalengkePayment.payToken. Approves first if the existing allowance is short.
 * `onApproving` fires when an approve tx is needed (UI shows the 'approving' step).
 */
export async function sendStablePayment(
  from: string,
  to: string,
  token: PayToken,
  amount: string,
  memo: string,
  hooks?: { onMinting?: () => void; onApproving?: () => void },
): Promise<PaymentResult> {
  if (!token.address) throw new Error('sendStablePayment requires an ERC-20 token');
  const units = parseUnits(amount, token.decimals);
  if (units <= 0n) throw new Error('amount must be greater than 0');

  let balance = await getTokenBalance(token, from);
  if (balance < units) {
    // Auto-fund from the open testnet faucet (mints FAUCET_AMOUNT whole tokens).
    hooks?.onMinting?.();
    await faucetToken(token);
    balance = await getTokenBalance(token, from);
    if (balance < units) {
      throw new Error(`Amount exceeds the test ${token.symbol} faucet limit. Enter a smaller amount.`);
    }
  }

  const allowance = await getTokenAllowance(token, from);
  if (allowance < units) {
    hooks?.onApproving?.();
    await approveToken(token, units);
  }

  const txHash = await writeContract({
    address: requirePayment(),
    abi: palengkePaymentAbi as never,
    functionName: 'payToken',
    args: [to as `0x${string}`, token.address, units, memo.trim()],
  });
  return { txHash };
}

// ── UTangEscrow ─────────────────────────────────────────────────────────────────

export type UtangStatus = 'active' | 'completed' | 'defaulted';

export interface UtangRecord {
  id: bigint;
  customerWallet: string;
  vendorWallet: string;
  totalAmountEth: number;
  installmentAmountEth: number;
  installmentsTotal: number;
  installmentsPaid: number;
  nextDueSecs: bigint;
  intervalDays: number;
  status: UtangStatus;
  description: string;
}

// Raw struct shape returned by viem for UTangEscrow.Utang (named tuple).
interface RawUtang {
  id: bigint;
  customer: string;
  vendor: string;
  totalAmount: bigint;
  installmentAmount: bigint;
  installmentsTotal: number;
  installmentsPaid: number;
  nextDue: bigint;
  intervalSeconds: bigint;
  status: number; // enum: 0 None, 1 Active, 2 Completed, 3 Defaulted
  description: string;
}

function mapUtang(raw: RawUtang): UtangRecord {
  const status: UtangStatus =
    raw.status === 2 ? 'completed' : raw.status === 3 ? 'defaulted' : 'active';
  return {
    id: raw.id,
    customerWallet: raw.customer,
    vendorWallet: raw.vendor,
    totalAmountEth: Number(formatEther(raw.totalAmount)),
    installmentAmountEth: Number(formatEther(raw.installmentAmount)),
    installmentsTotal: Number(raw.installmentsTotal),
    installmentsPaid: Number(raw.installmentsPaid),
    nextDueSecs: raw.nextDue,
    intervalDays: Math.round(Number(raw.intervalSeconds) / 86400),
    status,
    description: raw.description ?? '',
  };
}

async function fetchUtangs(fn: 'getCustomerUtangs' | 'getVendorUtangs', wallet: string): Promise<UtangRecord[]> {
  const raw = await readContractOrNull<RawUtang[]>(requireEscrow(), utangEscrowAbi as never, fn, [
    wallet as `0x${string}`, 50n, 0n,
  ]);
  if (!Array.isArray(raw)) return [];
  return raw.map(mapUtang);
}

export const getCustomerUtangs = (wallet: string) => fetchUtangs('getCustomerUtangs', wallet);
export const getVendorUtangs = (wallet: string) => fetchUtangs('getVendorUtangs', wallet);

export async function getUtang(id: bigint): Promise<UtangRecord | null> {
  const raw = await readContractOrNull<RawUtang>(requireEscrow(), utangEscrowAbi as never, 'getUtang', [id]);
  return raw ? mapUtang(raw) : null;
}

export async function getGracePeriodSecs(): Promise<number> {
  const v = await readContractOrNull<bigint>(requireEscrow(), utangEscrowAbi as never, 'gracePeriod', []);
  return v ? Number(v) : 7 * 86400;
}

export async function getCustomerDefaults(wallet: string): Promise<number> {
  const v = await readContractOrNull<number>(requireEscrow(), utangEscrowAbi as never, 'customerDefaults', [wallet as `0x${string}`]);
  return Number(v ?? 0);
}
export async function getVendorDefaults(wallet: string): Promise<number> {
  const v = await readContractOrNull<number>(requireEscrow(), utangEscrowAbi as never, 'vendorDefaults', [wallet as `0x${string}`]);
  return Number(v ?? 0);
}

export interface CreateUtangArgs {
  vendorWallet: string;
  totalAmountEth: number;
  installmentsTotal: number;
  intervalDays: number;
  description: string;
}

/** createUtang — customer (msg.sender) opens a plan. No funds collected here. */
export async function createUtang(args: CreateUtangArgs): Promise<string> {
  return writeContract({
    address: requireEscrow(),
    abi: utangEscrowAbi as never,
    functionName: 'createUtang',
    args: [
      args.vendorWallet as `0x${string}`,
      parseEther(String(args.totalAmountEth)),
      args.installmentsTotal,
      BigInt(args.intervalDays * 86400),
      args.description,
    ],
  });
}

/** Wei due for the next installment of a utang (payAmount + 1% reserve). */
export function installmentValueWei(u: UtangRecord): bigint {
  const total = parseEther(String(u.totalAmountEth));
  const installment = parseEther(String(u.installmentAmountEth));
  const remaining = u.installmentsTotal - u.installmentsPaid;
  const payAmount = remaining === 1 ? total - installment * BigInt(u.installmentsPaid) : installment;
  const reserveFee = (payAmount * RESERVE_BPS) / 10_000n;
  return payAmount + reserveFee;
}

export async function payInstallment(u: UtangRecord): Promise<string> {
  return writeContract({
    address: requireEscrow(),
    abi: utangEscrowAbi as never,
    functionName: 'payInstallment',
    args: [u.id],
    value: installmentValueWei(u),
  });
}

export function lateFeeValueWei(u: UtangRecord): bigint {
  const installment = parseEther(String(u.installmentAmountEth));
  return (installment * LATE_FEE_BPS) / 10_000n;
}

export async function resumeAfterLate(u: UtangRecord): Promise<string> {
  return writeContract({
    address: requireEscrow(),
    abi: utangEscrowAbi as never,
    functionName: 'resumeAfterLate',
    args: [u.id],
    value: lateFeeValueWei(u),
  });
}

export async function markDefault(utangId: bigint): Promise<string> {
  return writeContract({
    address: requireEscrow(),
    abi: utangEscrowAbi as never,
    functionName: 'markDefault',
    args: [utangId],
  });
}

// ── VendorRegistry ───────────────────────────────────────────────────────────────

export interface VendorRecord {
  id: bigint;
  wallet: string;
  marketId: string;
  name: string;
  stallNumber: string;
  phone: string;
  productType: string;
  registeredAt: bigint;
  totalTransactions: bigint;
  totalVolume: bigint;
  isActive: boolean;
}

export interface VendorApplication {
  wallet: string;
  marketId: string;
  name: string;
  stallNumber: string;
  phone: string;
  productType: string;
  appliedAt: bigint;
  status: number; // 0 None, 1 Pending, 2 Approved, 3 Rejected
}

export async function getVendor(wallet: string): Promise<VendorRecord | null> {
  return readContractOrNull<VendorRecord>(requireRegistry(), vendorRegistryAbi as never, 'getVendor', [wallet as `0x${string}`]);
}

export async function getApplication(wallet: string): Promise<VendorApplication | null> {
  return readContractOrNull<VendorApplication>(requireRegistry(), vendorRegistryAbi as never, 'getApplication', [wallet as `0x${string}`]);
}

export async function getPendingVendors(limit = 50, offset = 0): Promise<VendorApplication[]> {
  const raw = await readContractOrNull<VendorApplication[]>(requireRegistry(), vendorRegistryAbi as never, 'getPendingVendors', [BigInt(limit), BigInt(offset)]);
  return Array.isArray(raw) ? raw : [];
}

export async function getAllVendors(limit = 100, offset = 0): Promise<VendorRecord[]> {
  const raw = await readContractOrNull<VendorRecord[]>(requireRegistry(), vendorRegistryAbi as never, 'getAllVendors', [BigInt(limit), BigInt(offset)]);
  return Array.isArray(raw) ? raw : [];
}

/** Returns [sum, count]; average = sum/count computed client-side. */
export async function getVendorRating(vendor: string): Promise<{ sum: number; count: number }> {
  const raw = await readContractOrNull<readonly [number, number]>(requireRegistry(), vendorRegistryAbi as never, 'getVendorRating', [vendor as `0x${string}`]);
  return { sum: Number(raw?.[0] ?? 0), count: Number(raw?.[1] ?? 0) };
}

export async function hasRated(vendor: string, txHash: `0x${string}`): Promise<boolean> {
  const v = await readContractOrNull<boolean>(requireRegistry(), vendorRegistryAbi as never, 'hasRated', [vendor as `0x${string}`, txHash]);
  return !!v;
}

export async function applyVendor(a: { marketId: string; name: string; stallNumber: string; phone: string; productType: string }): Promise<string> {
  return writeContract({
    address: requireRegistry(),
    abi: vendorRegistryAbi as never,
    functionName: 'applyVendor',
    args: [a.marketId, a.name, a.stallNumber, a.phone, a.productType],
  });
}

export async function approveVendor(wallet: string): Promise<string> {
  return writeContract({ address: requireRegistry(), abi: vendorRegistryAbi as never, functionName: 'approveVendor', args: [wallet as `0x${string}`] });
}
export async function rejectVendor(wallet: string): Promise<string> {
  return writeContract({ address: requireRegistry(), abi: vendorRegistryAbi as never, functionName: 'rejectVendor', args: [wallet as `0x${string}`] });
}

export async function registerVendor(wallet: string, a: { marketId: string; name: string; stallNumber: string; phone: string; productType: string }): Promise<string> {
  return writeContract({
    address: requireRegistry(),
    abi: vendorRegistryAbi as never,
    functionName: 'registerVendor',
    args: [wallet as `0x${string}`, a.marketId, a.name, a.stallNumber, a.phone, a.productType],
  });
}

export async function updateProfile(a: { name: string; stallNumber: string; phone: string; productType: string }): Promise<string> {
  return writeContract({
    address: requireRegistry(),
    abi: vendorRegistryAbi as never,
    functionName: 'updateProfile',
    args: [a.name, a.stallNumber, a.phone, a.productType],
  });
}

/** submitRating — `txHash`/`commentHash` are bytes32 (0x + 64 hex). */
export async function submitRating(vendor: string, txHash: `0x${string}`, stars: number, commentHash: `0x${string}`): Promise<string> {
  return writeContract({
    address: requireRegistry(),
    abi: vendorRegistryAbi as never,
    functionName: 'submitRating',
    args: [vendor as `0x${string}`, txHash, stars, commentHash],
  });
}

export async function reportDefault(vendor: string, customer: string): Promise<string> {
  return writeContract({ address: requireRegistry(), abi: vendorRegistryAbi as never, functionName: 'reportDefault', args: [vendor as `0x${string}`, customer as `0x${string}`] });
}

export async function deactivateVendor(wallet: string): Promise<string> {
  return writeContract({ address: requireRegistry(), abi: vendorRegistryAbi as never, functionName: 'deactivateVendor', args: [wallet as `0x${string}`] });
}

/** True if `wallet` is a registered vendor (getVendor does not revert). */
export async function isRegisteredVendor(wallet: string): Promise<boolean> {
  return (await getVendor(wallet)) !== null;
}

export async function getVendorReadModel(wallet: string) {
  const [vendor, rating] = await Promise.all([getVendor(wallet), getVendorRating(wallet)]);
  return { vendor, rating };
}
