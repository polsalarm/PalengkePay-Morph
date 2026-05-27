import { useState, useEffect, useCallback } from 'react';
import {
  type UtangRecord, type UtangStatus,
  getCustomerUtangs, getVendorUtangs, getUtang,
  createUtang as createUtangTx, payInstallment as payInstallmentTx,
  resumeAfterLate as resumeAfterLateTx, markDefault as markDefaultTx,
  getGracePeriodSecs, getCustomerDefaults, getVendorDefaults,
  contractsDeployed,
} from '../contracts';
import { notifyWallet } from '../notify';

export type { UtangRecord, UtangStatus };

export function useVendorUtangs(vendorWallet: string | null) {
  const [utangs, setUtangs] = useState<UtangRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!vendorWallet) { setUtangs([]); setError(null); return; }
    setIsLoading(true);
    setError(null);
    getVendorUtangs(vendorWallet)
      .then(setUtangs)
      .catch((err: unknown) => {
        setError((err as { message?: string }).message ?? 'Failed to load utang agreements');
        setUtangs([]);
      })
      .finally(() => setIsLoading(false));
  }, [vendorWallet, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { utangs, isLoading, error, refetch };
}

export function useCustomerUtangs(customerWallet: string | null) {
  const [utangs, setUtangs] = useState<UtangRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!customerWallet) { setUtangs([]); setError(null); return; }
    setIsLoading(true);
    setError(null);
    getCustomerUtangs(customerWallet)
      .then(setUtangs)
      .catch((err: unknown) => {
        setError((err as { message?: string }).message ?? 'Failed to load utang agreements');
        setUtangs([]);
      })
      .finally(() => setIsLoading(false));
  }, [customerWallet, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { utangs, isLoading, error, refetch };
}

// ── Create utang ──────────────────────────────────────────────────────────────

export interface CreateUtangParams {
  vendorWallet: string;
  customerWallet: string; // retained for call-site compat; on-chain customer = msg.sender
  totalAmountEth: number;
  installmentsTotal: number;
  intervalDays: number;
  description: string;
}

export function useCreateUtang() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUtang = useCallback(async (
    params: CreateUtangParams,
    _signerAddress: string
  ): Promise<string | null> => {
    if (!contractsDeployed) {
      setError('UTangEscrow contract is not configured. Set VITE_UTANG_ESCROW_ADDRESS.');
      return null;
    }
    setIsCreating(true);
    setError(null);
    try {
      return await createUtangTx({
        vendorWallet: params.vendorWallet,
        totalAmountEth: params.totalAmountEth,
        installmentsTotal: params.installmentsTotal,
        intervalDays: params.intervalDays,
        description: params.description,
      });
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Failed to create utang');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { createUtang, isCreating, error };
}

// ── Pay installment ───────────────────────────────────────────────────────────

export type InstallmentStatus = 'idle' | 'building' | 'signing' | 'submitting' | 'confirmed' | 'failed';

export function usePayInstallment() {
  const [status, setStatus] = useState<InstallmentStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payInstallment = useCallback(async (utang: UtangRecord, _fromAddress: string) => {
    setStatus('submitting');
    setTxHash(null);
    setError(null);
    try {
      const hash = await payInstallmentTx(utang);
      setTxHash(hash);
      setStatus('confirmed');
      const nextNum = utang.installmentsPaid + 1;
      const isFinal = nextNum >= utang.installmentsTotal;
      notifyWallet(utang.vendorWallet, {
        title: isFinal ? 'PalengkePay — utang tapos na!' : 'PalengkePay — installment bayad',
        body: isFinal
          ? `Customer fully paid: ${utang.description}`
          : `Installment ${nextNum}/${utang.installmentsTotal} received · ${utang.installmentAmountEth.toFixed(4)} ETH · ${utang.description}`,
        tag: `utang-pay-${hash}`,
        url: '/vendor/utang',
      });
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? String(err);
      setError(
        msg.includes('rejected') || msg.includes('cancel') || msg.includes('User denied')
          ? 'Transaction cancelled — no funds sent'
          : msg.slice(0, 120)
      );
      setStatus('failed');
    }
  }, []);

  const reset = useCallback(() => { setStatus('idle'); setTxHash(null); setError(null); }, []);
  return { status, txHash, error, payInstallment, reset };
}

// ── Due date helpers ──────────────────────────────────────────────────────────

export function dueLabel(nextDueSecs: bigint | null | undefined): string {
  if (!nextDueSecs) return '';
  const diffMs = Number(nextDueSecs) * 1000 - Date.now();
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'due today';
  if (diffDays === 1) return 'due tomorrow';
  return `due in ${diffDays}d`;
}

export function isOverdue(nextDueSecs: bigint | null | undefined): boolean {
  if (!nextDueSecs) return false;
  return Number(nextDueSecs) * 1000 < Date.now();
}

export function daysPastDue(nextDueSecs: bigint | null | undefined): number {
  if (!nextDueSecs) return 0;
  return Math.floor((Date.now() - Number(nextDueSecs) * 1000) / 86400000);
}

export function secondsPastDue(nextDueSecs: bigint | null | undefined): number {
  if (!nextDueSecs) return 0;
  return Math.floor((Date.now() - Number(nextDueSecs) * 1000) / 1000);
}

export function formatGraceSeconds(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return '0s';
  if (secs % 86400 === 0) return `${secs / 86400}d`;
  if (secs % 3600 === 0) return `${secs / 3600}h`;
  if (secs % 60 === 0) return `${secs / 60}m`;
  return `${secs}s`;
}

export function useUtangGracePeriod(): { gracePeriodSecs: number; isLoading: boolean } {
  const [gracePeriodSecs, setGracePeriodSecs] = useState<number>(7 * 86400);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!contractsDeployed) { setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    getGracePeriodSecs()
      .then((n) => { if (!cancelled && Number.isFinite(n) && n > 0) setGracePeriodSecs(n); })
      .catch(() => { /* keep fallback */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { gracePeriodSecs, isLoading };
}

// ── Default counters ─────────────────────────────────────────────

export function useCustomerDefaults(wallet: string | null) {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!wallet || !contractsDeployed) { setCount(0); return; }
    setIsLoading(true);
    getCustomerDefaults(wallet)
      .then(setCount)
      .catch(() => setCount(0))
      .finally(() => setIsLoading(false));
  }, [wallet, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { count, isLoading, refetch };
}

export function useVendorDefaults(wallet: string | null) {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!wallet || !contractsDeployed) { setCount(0); return; }
    setIsLoading(true);
    getVendorDefaults(wallet)
      .then(setCount)
      .catch(() => setCount(0))
      .finally(() => setIsLoading(false));
  }, [wallet, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { count, isLoading, refetch };
}

// ── Admin: mark utang as defaulted ────────────────────────────────────────────

export function useMarkDefault() {
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markDefault = useCallback(async (_adminAddress: string, utangId: bigint): Promise<string | null> => {
    if (!contractsDeployed) { setError('UTangEscrow contract is not configured.'); return null; }
    setIsMarking(true);
    setError(null);
    try {
      return await markDefaultTx(utangId);
    } catch (err: unknown) {
      setError(((err as { message?: string }).message ?? String(err)).slice(0, 160));
      return null;
    } finally {
      setIsMarking(false);
    }
  }, []);

  return { markDefault, isMarking, error };
}

// ── Customer: resume defaulted utang by paying late fee ───────────────────────

export function useResumeAfterLate() {
  const [isResuming, setIsResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const resumeAfterLate = useCallback(async (_customerAddress: string, utangId: bigint): Promise<string | null> => {
    if (!contractsDeployed) { setError('UTangEscrow contract is not configured.'); return null; }
    setIsResuming(true);
    setError(null);
    setTxHash(null);
    try {
      const u = await getUtang(utangId);
      if (!u) throw new Error('Utang not found');
      const hash = await resumeAfterLateTx(u);
      setTxHash(hash);
      return hash;
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? String(err);
      setError(
        msg.includes('rejected') || msg.includes('cancel') || msg.includes('User denied')
          ? 'Transaction cancelled — no funds sent'
          : msg.slice(0, 160)
      );
      return null;
    } finally {
      setIsResuming(false);
    }
  }, []);

  return { resumeAfterLate, isResuming, error, txHash };
}
