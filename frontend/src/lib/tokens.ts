// Payable-token registry. PalengkePayment settles either native ETH (`pay`) or any
// ERC-20 (`payToken`). On Morph Hoodi there are no canonical stablecoins, so USDC/USDT
// /PHPp are testnet mocks deployed alongside the contract (see VITE_MOCK_*_ADDRESS).
//
// `kind` drives peso pricing:
//   - native: PHP value via the live ETH→PHP rate (CoinGecko).
//   - usd:    USD-pegged (USDC/USDT) → PHP via the USD→PHP rate.
//   - php:    PHP-pegged (PHPp) → 1 token = ₱1, no FX.

export type TokenKind = 'native' | 'usd' | 'php';

export interface PayToken {
  key: string;
  symbol: string;
  label: string;
  /** null = native ETH (msg.value); otherwise the ERC-20 contract address. */
  address: `0x${string}` | null;
  decimals: number;
  kind: TokenKind;
}

const env = import.meta.env;

export const NATIVE_TOKEN: PayToken = {
  key: 'eth',
  symbol: 'ETH',
  label: 'Ether (native)',
  address: null,
  decimals: 18,
  kind: 'native',
};

function stable(
  key: string,
  symbol: string,
  label: string,
  kind: TokenKind,
  envAddr: string | undefined,
): PayToken | null {
  const address = (envAddr ?? '').trim();
  if (!address) return null;
  return { key, symbol, label, address: address as `0x${string}`, decimals: 6, kind };
}

const STABLES: PayToken[] = [
  stable('usdc', 'USDC', 'USD Coin', 'usd', env.VITE_MOCK_USDC_ADDRESS as string | undefined),
  stable('usdt', 'USDT', 'Tether USD', 'usd', env.VITE_MOCK_USDT_ADDRESS as string | undefined),
  stable('phpp', 'PHPp', 'Peso (pegged)', 'php', env.VITE_MOCK_PHPP_ADDRESS as string | undefined),
].filter((t): t is PayToken => t !== null);

/** All tokens the pay flow can offer (native first, then any configured stablecoins). */
export const PAY_TOKENS: PayToken[] = [NATIVE_TOKEN, ...STABLES];

/** True when at least one ERC-20 stablecoin is configured. */
export const STABLECOINS_ENABLED = STABLES.length > 0;

export function getTokenByKey(key: string): PayToken {
  return PAY_TOKENS.find((t) => t.key === key) ?? NATIVE_TOKEN;
}

/** Resolve a token by on-chain address (case-insensitive); null/zero address → native. */
export function getTokenByAddress(address?: string | null): PayToken {
  if (!address || /^0x0+$/.test(address)) return NATIVE_TOKEN;
  const lower = address.toLowerCase();
  return PAY_TOKENS.find((t) => t.address?.toLowerCase() === lower) ?? NATIVE_TOKEN;
}
