import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Store, Zap, Coins } from 'lucide-react';
import type { VendorProfile } from '../lib/hooks/useVendor';
import type { PaymentSettlementMode } from '../lib/payment-routing';
import {
  buildStableCheckoutQuote,
  formatPhp,
  formatSettlement,
  isQuoteExpired,
  quoteSecondsRemaining,
  type StableCheckoutQuote,
} from '../lib/checkout-quote';
import { PAY_TOKENS, NATIVE_TOKEN, type PayToken } from '../lib/tokens';
import { faucetToken } from '../lib/contracts';

const MEMO_MAX = 28;
const FALLBACK_ETH_PHP = 200_000; // PHP per 1 ETH when rate sources are unreachable.
const FALLBACK_USD_PHP = 58;      // PHP per 1 USD (USDC/USDT) fallback.

interface Props {
  vendorAddress: string;
  vendor: VendorProfile | null;
  isLoading: boolean;
  preloadedVendorName?: string;
  preloadedStallInfo?: string;
  onSubmit: (amount: string, memo: string, quote: StableCheckoutQuote, token: PayToken) => void;
  disabled?: boolean;
  settlementMode?: PaymentSettlementMode;
}

export function PaymentForm({ vendorAddress, vendor, isLoading, preloadedVendorName, preloadedStallInfo, onSubmit, disabled, settlementMode = 'fee-bump' }: Props) {
  const [amountPhp, setAmountPhp] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState<PayToken>(NATIVE_TOKEN);
  const [ethPhp, setEthPhp] = useState<number>(FALLBACK_ETH_PHP);
  const [usdPhp, setUsdPhp] = useState<number>(FALLBACK_USD_PHP);
  const [quoteSource, setQuoteSource] = useState<StableCheckoutQuote['source']>('fallback');
  const [rateLoading, setRateLoading] = useState(false);
  const [quote, setQuote] = useState<StableCheckoutQuote | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [faucetState, setFaucetState] = useState<'idle' | 'minting' | 'done'>('idle');

  // ETH→PHP (native settlement): API quote endpoint, then CoinGecko ethereum.
  useEffect(() => {
    let cancelled = false;
    async function loadEthRate() {
      setRateLoading(true);
      try {
        const response = await fetch('/api/quote');
        if (!response.ok) throw new Error('quote API unavailable');
        const data = await response.json();
        if (!Number.isFinite(Number(data?.phpPerEth))) throw new Error('quote API returned invalid rate');
        if (!cancelled) {
          setEthPhp(Number(data.phpPerEth));
          setQuoteSource('api');
        }
      } catch {
        try {
          const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=php');
          const data = await response.json();
          if (!cancelled && data?.ethereum?.php) {
            setEthPhp(data.ethereum.php);
            setQuoteSource('coingecko');
          }
        } catch { /* keep fallback */ }
      } finally {
        if (!cancelled) setRateLoading(false);
      }
    }
    void loadEthRate();
    return () => { cancelled = true; };
  }, []);

  // USD→PHP (USDC/USDT settlement): CoinGecko usd-coin in PHP.
  useEffect(() => {
    let cancelled = false;
    async function loadUsdRate() {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=php');
        const data = await response.json();
        if (!cancelled && Number.isFinite(Number(data?.['usd-coin']?.php))) {
          setUsdPhp(Number(data['usd-coin'].php));
        }
      } catch { /* keep fallback */ }
    }
    void loadUsdRate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // PHP per 1 unit of the selected settlement token.
  const phpPerToken = token.kind === 'php' ? 1 : token.kind === 'usd' ? usdPhp : ethPhp;

  useEffect(() => {
    if (!amountPhp.trim()) {
      setQuote(null);
      return;
    }
    try {
      setQuote(buildStableCheckoutQuote({
        phpAmount: amountPhp,
        phpPerEth: phpPerToken,
        source: token.kind === 'php' ? 'fallback' : quoteSource,
        token: { symbol: token.symbol, decimals: token.decimals, kind: token.kind },
      }));
    } catch {
      setQuote(null);
    }
  }, [amountPhp, phpPerToken, quoteSource, token]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!quote) {
      setError('Enter PHP amount greater than 0');
      return;
    }
    if (isQuoteExpired(quote, nowMs)) {
      setError('Quote expired. Refresh the amount to lock a new price.');
      return;
    }
    if (!(Number(quote.xlmAmount) > 0)) {
      setError(`Amount too small to settle in ${token.symbol} at the current rate. Enter a larger amount.`);
      return;
    }
    onSubmit(quote.xlmAmount, memo, quote, token);
  };

  const handleFaucet = async () => {
    if (token.kind === 'native') return;
    setFaucetState('minting');
    try {
      await faucetToken(token);
      setFaucetState('done');
    } catch {
      setFaucetState('idle');
    }
  };

  const displayName = vendor?.name ?? preloadedVendorName ?? null;
  const displayStall = vendor
    ? `Stall ${vendor.stallNumber} · ${vendor.productType}`
    : preloadedStallInfo ?? null;

  const memoLeft = MEMO_MAX - memo.length;
  const memoNearLimit = memoLeft <= 8;
  const quoteSeconds = quote ? quoteSecondsRemaining(quote, nowMs) : 0;
  const rateLabel = token.kind === 'php'
    ? `₱1.00 = 1 ${token.symbol}`
    : `₱${phpPerToken.toFixed(2)}/${token.symbol}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* ── Vendor card ── */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ backgroundColor: '#F0FDFA', border: '2px solid #CCFBF1' }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#008055' }}
        >
          <Store size={20} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          {isLoading && !preloadedVendorName ? (
            <>
              <div className="h-4 w-32 skeleton rounded mb-1.5" />
              <div className="h-3 w-24 skeleton rounded" />
            </>
          ) : displayName ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: '#008055' }}>
                Nagbabayad kay
              </p>
              <p className="text-base font-black text-slate-900 truncate" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                {displayName}
              </p>
              {displayStall && (
                <p className="text-xs text-slate-400 mt-0.5">{displayStall}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: '#008055' }}>
                Nagbabayad sa
              </p>
              <p className="text-sm font-mono text-slate-500 truncate">{vendorAddress}</p>
            </>
          )}
        </div>
      </div>

      {/* ── Token selector ── */}
      {PAY_TOKENS.length > 1 && (
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
            Bayad gamit ang
          </label>
          <div className="grid grid-cols-4 gap-2">
            {PAY_TOKENS.map((t) => {
              const active = t.key === token.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setToken(t); setFaucetState('idle'); }}
                  className="rounded-xl py-2.5 text-sm font-black active:scale-95 transition-all"
                  style={active
                    ? { backgroundColor: '#008055', color: 'white', boxShadow: '0 4px 14px rgba(15,118,110,0.35)' }
                    : { backgroundColor: '#F1F5F9', color: '#475569' }
                  }
                >
                  {t.symbol}
                </button>
              );
            })}
          </div>
          {token.kind !== 'native' && (
            <button
              type="button"
              onClick={handleFaucet}
              disabled={faucetState === 'minting'}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold active:scale-95 disabled:opacity-50"
              style={{ color: '#008055' }}
            >
              <Coins size={13} />
              {faucetState === 'minting' ? 'Minting test tokens…'
                : faucetState === 'done' ? `Test ${token.symbol} minted ✓`
                : `Need test ${token.symbol}? Tap to mint`}
            </button>
          )}
        </div>
      )}

      {/* ── Amount ── */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
          Halaga (PHP)
        </label>
        <div className="relative">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black"
            style={{ color: '#94A3B8', fontFamily: "'Syne', sans-serif" }}
          >
            ₱
          </span>
          <input
            type="number"
            inputMode="decimal"
            value={amountPhp}
            onChange={(e) => {
              setAmountPhp(e.target.value);
              setError('');
            }}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full rounded-2xl px-4 font-black text-slate-900 focus:outline-none transition-all"
            style={{
              border: '2px solid #E2E8F0',
              padding: '16px 16px 16px 42px',
              fontSize: '1.6rem',
              letterSpacing: '-0.02em',
              fontFamily: "'Montserrat', sans-serif",
            }}
            onFocus={(e) => { e.target.style.borderColor = '#008055'; }}
            onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
            autoFocus
          />
        </div>

        {quote && (
          <div
            className="mt-2 rounded-2xl p-3"
            style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #E2E8F0' }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Locked {token.symbol}
                </p>
                <p className="text-lg font-black text-slate-900" style={{ fontFamily: "'Syne', sans-serif" }}>
                  {formatSettlement(quote)}
                </p>
              </div>
              <div
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-black"
                style={{ backgroundColor: quoteSeconds <= 10 ? '#FFF1F2' : '#F0FDFA', color: quoteSeconds <= 10 ? '#E11D48' : '#0F766E' }}
              >
                <Clock size={13} />
                {quoteSeconds}s
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {formatPhp(quote.phpAmount)} at {rateLabel}{rateLoading && token.kind === 'native' ? ' · refreshing rate' : ''}
            </p>
          </div>
        )}
      </div>

      {/* ── Memo ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-black uppercase tracking-wider text-slate-500">
            Ano ang binili? <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span>
          </label>
          <span
            className="text-xs font-bold tabular-nums"
            style={{ color: memoNearLimit ? '#F59E0B' : '#CBD5E1' }}
          >
            {memo.length}/{MEMO_MAX}
          </span>
        </div>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="e.g. 2kg tilapia"
          maxLength={MEMO_MAX}
          className="w-full rounded-2xl px-4 py-3.5 text-sm font-semibold text-slate-800 focus:outline-none transition-all placeholder:font-normal placeholder:text-slate-300"
          style={{ border: '2px solid #E2E8F0' }}
          onFocus={(e) => { e.target.style.borderColor = '#008055'; }}
          onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; }}
        />
      </div>

      {error && (
        <p className="text-xs font-semibold px-1" style={{ color: '#F43F5E' }}>{error}</p>
      )}

      {/* ── Settlement badge ── */}
      <div
        className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold"
        style={settlementMode === 'contract'
          ? { backgroundColor: '#F0FDF4', color: '#16A34A' }
          : { backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }
        }
      >
        {settlementMode === 'contract'
          ? <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22C55E' }} />
          : <AlertTriangle size={13} style={{ color: '#D97706' }} />
        }
        {settlementMode === 'contract'
          ? (token.kind === 'native'
              ? 'On-chain receipt — settled in native ETH'
              : `On-chain receipt — settled in ${token.symbol} stablecoin`)
          : 'Payment contract not configured — using direct transfer'}
      </div>

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={disabled}
        className="w-full text-white font-black rounded-2xl active:scale-95 transition-all disabled:opacity-40"
        style={{
          backgroundColor: '#008055',
          minHeight: '60px',
          fontSize: '1.05rem',
          fontFamily: "'Montserrat', sans-serif",
          boxShadow: '0 6px 24px rgba(15,118,110,0.35)',
        }}
      >
        <Zap size={16} className="inline mr-2 -mt-0.5" />
        Bayaran ang Locked Quote
      </button>
    </form>
  );
}
