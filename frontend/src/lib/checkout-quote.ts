import type { TokenKind } from './tokens';

export const QUOTE_TTL_MS = 60_000;

export interface StableCheckoutQuote {
  phpAmount: number;
  /** PHP per 1 unit of the settlement token (ETH→PHP for native, USD→PHP for USDC/USDT, 1 for PHPp). */
  phpPerEth: number;
  /** Settlement amount in token units, as a decimal string (field name kept for back-compat). */
  xlmAmount: string;
  /** Settlement token metadata. Optional so proofs persisted before stablecoins still type-check. */
  tokenSymbol?: string;
  tokenDecimals?: number;
  tokenKind?: TokenKind;
  generatedAt: string;
  expiresAt: string;
  source: 'api' | 'coingecko' | 'fallback';
}

interface QuoteToken {
  symbol: string;
  decimals: number;
  kind: TokenKind;
}

const DEFAULT_TOKEN: QuoteToken = { symbol: 'ETH', decimals: 18, kind: 'native' };

interface BuildQuoteInput {
  phpAmount: string;
  /** PHP per 1 settlement token. */
  phpPerEth: number;
  nowMs?: number;
  source?: StableCheckoutQuote['source'];
  token?: QuoteToken;
}

// Native ETH historically displayed 7 dp; ERC-20 stables use their own (6 dp). Capping
// here keeps `xlmAmount` safe to feed straight into viem parseUnits(amount, decimals).
function settlementDecimals(token: QuoteToken): number {
  return token.kind === 'native' ? 7 : token.decimals;
}

export function buildStableCheckoutQuote({
  phpAmount,
  phpPerEth,
  nowMs = Date.now(),
  source = 'fallback',
  token = DEFAULT_TOKEN,
}: BuildQuoteInput): StableCheckoutQuote {
  const parsedPhp = Number(phpAmount);
  if (!Number.isFinite(parsedPhp) || parsedPhp <= 0) {
    throw new Error('PHP amount must be greater than 0');
  }
  if (!Number.isFinite(phpPerEth) || phpPerEth <= 0) {
    throw new Error('quote rate must be greater than 0');
  }

  return {
    phpAmount: parsedPhp,
    phpPerEth,
    xlmAmount: (parsedPhp / phpPerEth).toFixed(settlementDecimals(token)),
    tokenSymbol: token.symbol,
    tokenDecimals: token.decimals,
    tokenKind: token.kind,
    generatedAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(nowMs + QUOTE_TTL_MS).toISOString(),
    source,
  };
}

export function isQuoteExpired(quote: StableCheckoutQuote, nowMs = Date.now()): boolean {
  return nowMs >= new Date(quote.expiresAt).getTime();
}

export function quoteSecondsRemaining(quote: StableCheckoutQuote, nowMs = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(quote.expiresAt).getTime() - nowMs) / 1000));
}

export function formatPhp(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatEth(amount: string | number): string {
  const asNumber = Number(amount);
  const formatted = Number.isFinite(asNumber)
    ? asNumber.toLocaleString('en-US', { maximumFractionDigits: 7 })
    : String(amount);
  return `${formatted} ETH`;
}

/** Settlement amount with the quote's actual token symbol (ETH, USDC, USDT, PHPp). */
export function formatSettlement(quote: Pick<StableCheckoutQuote, 'xlmAmount' | 'tokenSymbol' | 'tokenDecimals'>): string {
  const asNumber = Number(quote.xlmAmount);
  const maxFrac = Math.min(quote.tokenDecimals ?? 7, 7);
  const formatted = Number.isFinite(asNumber)
    ? asNumber.toLocaleString('en-US', { maximumFractionDigits: maxFrac })
    : quote.xlmAmount;
  return `${formatted} ${quote.tokenSymbol ?? 'ETH'}`;
}
