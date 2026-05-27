import { useCallback, useEffect, useState } from 'react';
import {
  getVendorRating, hasRated as hasRatedChain, submitRating as submitRatingTx,
  REGISTRY_ADDRESS,
} from '../contracts';
import { summarize, type RatingSummary } from '../rating';

const configured = !!REGISTRY_ADDRESS;

const summaryCache = new Map<string, RatingSummary>();
const ratedCache = new Map<string, boolean>(); // key: `${vendor}|${txHash}`

const ratedKey = (vendor: string, txHash: string) => `${vendor}|${txHash}`;
/** Coerce a hex string to a 0x-prefixed bytes32 literal. */
const as0x = (hex: string): `0x${string}` => (hex.startsWith('0x') ? hex : `0x${hex}`) as `0x${string}`;

export function useVendorRating(vendor: string | null) {
  const [summary, setSummary] = useState<RatingSummary | null>(
    vendor ? (summaryCache.get(vendor) ?? null) : null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!vendor || !configured) return;
    let cancelled = false;
    setIsLoading(true);
    getVendorRating(vendor)
      .then(({ sum, count }) => {
        if (cancelled) return;
        const s = summarize(sum, count);
        summaryCache.set(vendor, s);
        setSummary(s);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [vendor, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { summary, isLoading, refetch };
}

export function useBulkVendorRatings(vendors: string[]) {
  const [summaries, setSummaries] = useState<Map<string, RatingSummary>>(() => {
    const m = new Map<string, RatingSummary>();
    for (const v of vendors) {
      const cached = summaryCache.get(v);
      if (cached) m.set(v, cached);
    }
    return m;
  });

  useEffect(() => {
    if (vendors.length === 0 || !configured) return;
    let cancelled = false;
    Promise.all(
      vendors.map((v) =>
        getVendorRating(v)
          .then(({ sum, count }) => [v, summarize(sum, count)] as const)
          .catch(() => [v, summarize(0, 0)] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const m = new Map<string, RatingSummary>();
      for (const [v, s] of entries) {
        summaryCache.set(v, s);
        m.set(v, s);
      }
      setSummaries(m);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendors.join('|')]);

  return { summaries };
}

export function useHasRated(vendor: string | null, txHash: string | null) {
  const [hasRated, setHasRated] = useState<boolean | null>(
    vendor && txHash ? (ratedCache.get(ratedKey(vendor, txHash)) ?? null) : null,
  );

  useEffect(() => {
    if (!vendor || !txHash || !configured) return;
    let cancelled = false;
    hasRatedChain(vendor, as0x(txHash))
      .then((b) => {
        if (cancelled) return;
        ratedCache.set(ratedKey(vendor, txHash), b);
        setHasRated(b);
      })
      .catch(() => { if (!cancelled) setHasRated(false); });
    return () => { cancelled = true; };
  }, [vendor, txHash]);

  return hasRated;
}

export function useSubmitRating() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const submit = useCallback(async (
    _customer: string,
    vendor: string,
    paymentTxHash: string,
    stars: number,
    commentHashHex: string,
  ): Promise<boolean> => {
    if (!configured) { setError('VendorRegistry contract not deployed'); return false; }
    if (stars < 1 || stars > 5) { setError('Stars must be 1–5'); return false; }
    setIsSubmitting(true);
    setError(null);
    setTxHash(null);
    try {
      const hash = await submitRatingTx(vendor, as0x(paymentTxHash), stars, as0x(commentHashHex));
      setTxHash(hash);
      summaryCache.delete(vendor);
      ratedCache.set(ratedKey(vendor, paymentTxHash), true);
      return true;
    } catch (err: unknown) {
      setError((err as { message?: string }).message ?? 'Rating failed');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submit, isSubmitting, error, txHash };
}
