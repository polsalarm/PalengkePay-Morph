import { Transak } from '@transak/transak-sdk';

// Transak fiat on/off-ramp (real provider). This SDK version is URL-driven: the
// crypto params go in the widget URL query; the SDK loads it in an iframe overlay.
//
// Config via env:
//   VITE_TRANSAK_API_KEY      — from the Transak dashboard (required to open)
//   VITE_TRANSAK_ENVIRONMENT  — STAGING (default) | PRODUCTION
//   VITE_TRANSAK_NETWORK      — Transak network code (default 'ethereum')
//   VITE_TRANSAK_CRYPTO       — crypto symbol (default 'ETH')
//
// NOTE: Transak does not currently list Morph as a supported network, and testnet
// crypto has no fiat value — so on Morph Hoodi this is a wired scaffold: the widget
// opens, but a real BUY/SELL settles only on a Transak-supported network/asset. Point
// VITE_TRANSAK_NETWORK at a supported chain to exercise the full flow.

const API_KEY = (import.meta.env.VITE_TRANSAK_API_KEY as string | undefined)?.trim();
const ENVIRONMENT = ((import.meta.env.VITE_TRANSAK_ENVIRONMENT as string) ?? 'STAGING').toUpperCase();
const NETWORK = (import.meta.env.VITE_TRANSAK_NETWORK as string) ?? 'ethereum';
const CRYPTO = (import.meta.env.VITE_TRANSAK_CRYPTO as string) ?? 'ETH';
const BASE = ENVIRONMENT === 'PRODUCTION' ? 'https://global.transak.com' : 'https://global-stg.transak.com';

export const transakConfigured = !!API_KEY;
export type RampProduct = 'BUY' | 'SELL';

export interface OpenTransakOpts {
  product: RampProduct;
  walletAddress?: string;
  /** Prefill fiat amount (PHP) for BUY. */
  fiatAmount?: number;
  onSuccess?: (data: unknown) => void;
  onClose?: () => void;
}

/** Open the Transak widget overlay. Returns the instance (call .close() to dismiss). */
export function openTransak(opts: OpenTransakOpts): Transak {
  if (!API_KEY) throw new Error('Transak not configured — set VITE_TRANSAK_API_KEY');

  const params = new URLSearchParams({
    apiKey: API_KEY,
    environment: ENVIRONMENT,
    productsAvailed: opts.product,
    network: NETWORK,
    defaultCryptoCurrency: CRYPTO,
    cryptoCurrencyList: CRYPTO,
    fiatCurrency: 'PHP',
    themeColor: '008055',
  });
  if (opts.walletAddress) params.set('walletAddress', opts.walletAddress);
  if (opts.fiatAmount) params.set('fiatAmount', String(opts.fiatAmount));

  const transak = new Transak({ widgetUrl: `${BASE}?${params.toString()}`, referrer: window.location.origin });
  transak.init();

  Transak.on(Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, (data) => opts.onSuccess?.(data));
  Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, () => { transak.cleanup(); opts.onClose?.(); });

  return transak;
}
