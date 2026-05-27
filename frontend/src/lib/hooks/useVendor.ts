import { useState, useEffect, useCallback } from 'react';
import {
  type VendorRecord, type VendorApplication as RawApplication,
  getVendor, getAllVendors, getPendingVendors,
  applyVendor as applyVendorTx, approveVendor as approveVendorTx,
  rejectVendor as rejectVendorTx, deactivateVendor as deactivateVendorTx,
  isRegisteredVendor as isRegisteredVendorChain,
  REGISTRY_ADDRESS,
} from '../contracts';

export { isRegisteredVendorChain as isRegisteredVendor };

// Module-level cache so repeated renders don't re-fetch same address
const vendorNameCache = new Map<string, string>();

export interface VendorProfile {
  id: number;
  wallet: string;
  name: string;
  stallNumber: string;
  productType: string;
  marketId: string;
  phone: string;
  totalTransactions: number;
  totalVolume: bigint;
  isActive: boolean;
}

export interface VendorApplication {
  wallet: string;
  name: string;
  stallNumber: string;
  productType: string;
  marketId: string;
  phone: string;
  appliedAt: bigint;
  status: 'pending' | 'approved' | 'rejected';
}

const configured = !!REGISTRY_ADDRESS;

function mapVendor(r: VendorRecord): VendorProfile {
  return {
    id: Number(r.id),
    wallet: r.wallet,
    name: r.name,
    stallNumber: r.stallNumber,
    productType: r.productType,
    marketId: r.marketId,
    phone: r.phone,
    totalTransactions: Number(r.totalTransactions),
    totalVolume: r.totalVolume,
    isActive: r.isActive,
  };
}

function mapApplication(r: RawApplication): VendorApplication {
  // status enum: 1 Pending, 2 Approved, 3 Rejected
  const status: VendorApplication['status'] =
    r.status === 2 ? 'approved' : r.status === 3 ? 'rejected' : 'pending';
  return {
    wallet: r.wallet,
    name: r.name,
    stallNumber: r.stallNumber,
    productType: r.productType,
    marketId: r.marketId,
    phone: r.phone,
    appliedAt: r.appliedAt,
    status,
  };
}

// ── Resolve vendor name by address (with cache) ───────────────────────────────

export function useVendorName(address: string | null): string | null {
  const [name, setName] = useState<string | null>(
    address ? (vendorNameCache.get(address) ?? null) : null
  );

  useEffect(() => {
    if (!address || !configured) return;
    if (vendorNameCache.has(address)) { setName(vendorNameCache.get(address)!); return; }
    getVendor(address)
      .then((v) => { if (v?.name) { vendorNameCache.set(address, v.name); setName(v.name); } })
      .catch(() => {});
  }, [address]);

  return name;
}

// ── Get single vendor ─────────────────────────────────────────────────────────

export function useVendor(walletAddress: string | null) {
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!walletAddress) { setVendor(null); return; }
    if (!configured) { setNotFound(true); return; }

    setIsLoading(true);
    setNotFound(false);
    getVendor(walletAddress)
      .then((raw) => {
        if (!raw) { setNotFound(true); setVendor(null); return; }
        setVendor(mapVendor(raw));
      })
      .catch(() => { setNotFound(true); setVendor(null); })
      .finally(() => setIsLoading(false));
  }, [walletAddress]);

  return { vendor, isLoading, notFound };
}

// ── All registered vendors ────────────────────────────────────────────────────

export function useAllVendors() {
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!configured) return;
    setIsLoading(true);
    setError(null);
    getAllVendors(50, 0)
      .then((raw) => setVendors(raw.map(mapVendor)))
      .catch((e: unknown) => {
        setVendors([]);
        setError((e as { message?: string }).message ?? 'Fetch failed');
      })
      .finally(() => setIsLoading(false));
  }, [tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { vendors, isLoading, error, refetch };
}

// ── Pending applications ──────────────────────────────────────────────────────

export function usePendingVendors() {
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!configured) return;
    setIsLoading(true);
    setError(null);
    getPendingVendors(50, 0)
      .then((raw) => setApplications(raw.map(mapApplication)))
      .catch((e: unknown) => {
        setApplications([]);
        setError((e as { message?: string }).message ?? 'Fetch failed');
      })
      .finally(() => setIsLoading(false));
  }, [tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { applications, isLoading, error, refetch };
}

// ── Apply as vendor (self-service) ────────────────────────────────────────────

export function useApplyVendor() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const apply = useCallback(async (
    wallet: string,
    name: string,
    stallNumber: string,
    phone: string,
    productType: string,
    marketId = 'marikina-public-market',
  ): Promise<boolean> => {
    if (!configured) { setError('VendorRegistry contract not deployed'); return false; }
    setIsSubmitting(true);
    setError(null);
    setTxHash(null);
    try {
      const existing = await getVendor(wallet).catch(() => null);
      if (existing) {
        setError('Already registered as vendor. Go to your vendor dashboard.');
        return false;
      }
      const hash = await applyVendorTx({ marketId, name, stallNumber, phone, productType });
      setTxHash(hash);
      return true;
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Application failed');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { apply, isSubmitting, error, txHash };
}

// ── Admin approve/reject/deactivate ───────────────────────────────────────────

export function useAdminActions() {
  const [loadingWallet, setLoadingWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (
    vendorWallet: string,
    tx: () => Promise<string>,
    failMsg: string,
  ): Promise<boolean> => {
    if (!configured) return false;
    setLoadingWallet(vendorWallet);
    setError(null);
    try {
      await tx();
      return true;
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? failMsg);
      return false;
    } finally {
      setLoadingWallet(null);
    }
  }, []);

  const approve = useCallback((_adminAddress: string, vendorWallet: string) =>
    run(vendorWallet, () => approveVendorTx(vendorWallet), 'Approve failed'), [run]);

  const reject = useCallback((_adminAddress: string, vendorWallet: string) =>
    run(vendorWallet, () => rejectVendorTx(vendorWallet), 'Reject failed'), [run]);

  const deactivate = useCallback((_adminAddress: string, vendorWallet: string) =>
    run(vendorWallet, async () => {
      const hash = await deactivateVendorTx(vendorWallet);
      vendorNameCache.delete(vendorWallet);
      return hash;
    }, 'Deactivate failed'), [run]);

  return { approve, reject, deactivate, loadingWallet, error };
}
