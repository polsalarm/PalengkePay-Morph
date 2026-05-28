import { useEffect, useMemo, useState } from 'react';
import { useAllVendors, usePendingVendors } from './useVendor';
import {
  buildPaymentMetrics,
  fetchContractPaymentsForVendors,
  hasPaymentContractSource,
  type PaymentMetrics,
  type ProductBreakdown,
  type MetricSummary,
  type TopVendor,
} from '../payment-source';

export type { MetricSummary, ProductBreakdown, TopVendor };

export type MetricsSource = 'palengke-payment' | 'registry-fallback';

export function useMetrics() {
  const { vendors, isLoading: vendorsLoading, error: vendorsError, refetch } = useAllVendors();
  const { applications, isLoading: pendingLoading } = usePendingVendors();
  const [paymentMetrics, setPaymentMetrics] = useState<PaymentMetrics | null>(null);
  const [paymentMetricsLoading, setPaymentMetricsLoading] = useState(false);
  const [paymentMetricsError, setPaymentMetricsError] = useState<string | null>(null);
  const [metricsSource, setMetricsSource] = useState<MetricsSource>('palengke-payment');

  const registryFallbackMetrics = useMemo<PaymentMetrics>(() => {
    const active = vendors.filter((v) => v.isActive);
    const totalVolumeEth = vendors.reduce((s, v) => s + Number(v.totalVolume) / 10_000_000, 0);
    const totalTransactions = vendors.reduce((s, v) => s + v.totalTransactions, 0);
    const summary: MetricSummary = {
      totalVendors: vendors.length,
      activeVendors: active.length,
      pendingVendors: applications.length,
      totalVolumeEth,
      totalTransactions,
      avgTxEth: totalTransactions > 0 ? totalVolumeEth / totalTransactions : 0,
    };

    const map = new Map<string, { count: number; volumeEth: number }>();
    for (const v of vendors) {
      const key = v.productType || 'other';
      const existing = map.get(key) ?? { count: 0, volumeEth: 0 };
      map.set(key, {
        count: existing.count + 1,
        volumeEth: existing.volumeEth + Number(v.totalVolume) / 10_000_000,
      });
    }
    const total = vendors.length || 1;
    const productBreakdown: ProductBreakdown[] = Array.from(map.entries())
      .map(([type, { count, volumeEth }]) => ({ type, count, volumeEth, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);

    const topVendors: TopVendor[] = [...vendors]
      .filter((v) => v.isActive)
      .sort((a, b) => Number(b.totalVolume) - Number(a.totalVolume))
      .slice(0, 5)
      .map((v) => ({
        wallet: v.wallet,
        name: v.name,
        stallNumber: v.stallNumber,
        productType: v.productType,
        totalTransactions: v.totalTransactions,
        volumeEth: Number(v.totalVolume) / 10_000_000,
      }));

    return { summary, productBreakdown, topVendors };
  }, [vendors, applications.length]);

  useEffect(() => {
    if (vendorsLoading || vendors.length === 0) {
      setPaymentMetrics(buildPaymentMetrics(vendors, [], applications.length));
      return;
    }

    if (!hasPaymentContractSource()) {
      setPaymentMetrics(null);
      setMetricsSource('registry-fallback');
      setPaymentMetricsError(null);
      return;
    }

    let cancelled = false;
    setPaymentMetricsLoading(true);
    setPaymentMetricsError(null);

    fetchContractPaymentsForVendors(vendors)
      .then((payments) => {
        if (cancelled) return;
        setPaymentMetrics(buildPaymentMetrics(vendors, payments, applications.length));
        setMetricsSource('palengke-payment');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPaymentMetrics(null);
        setMetricsSource('registry-fallback');
        setPaymentMetricsError((error as { message?: string }).message ?? 'Payment metrics unavailable');
      })
      .finally(() => {
        if (!cancelled) setPaymentMetricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vendors, applications.length, vendorsLoading]);

  const metrics = paymentMetrics ?? registryFallbackMetrics;

  return {
    summary: metrics.summary,
    productBreakdown: metrics.productBreakdown,
    topVendors: metrics.topVendors,
    metricsSource,
    isLoading: vendorsLoading || pendingLoading || paymentMetricsLoading,
    error: vendorsError ?? paymentMetricsError,
    refetch,
  };
}
