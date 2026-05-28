import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createConfig, http as wagmiHttp } from 'wagmi';
import { mock } from 'wagmi/connectors';
import { createPublicClient, http } from 'viem';
import { morphHoodi } from './chain';

// E2E mode: Playwright sets window.__PP_E2E__ before app load (addInitScript) so we
// swap RainbowKit for a wagmi mock connector with a fixed test account that
// auto-connects (see WalletProvider). Lets wallet-gated pages render in tests.
export const E2E_TEST_ADDRESS = '0x1111111111111111111111111111111111111111' as const;
export const isE2E = typeof window !== 'undefined'
  && (window as unknown as { __PP_E2E__?: boolean }).__PP_E2E__ === true;

// WalletConnect project id enables mobile/QR wallets. Injected (MetaMask) works
// without it; for WalletConnect set VITE_WALLETCONNECT_PROJECT_ID.
const WALLETCONNECT_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) || 'palengkepay-dev';

export const wagmiConfig = isE2E
  ? createConfig({
      chains: [morphHoodi],
      transports: { [morphHoodi.id]: wagmiHttp() },
      connectors: [mock({ accounts: [E2E_TEST_ADDRESS], features: { reconnect: true } })],
    })
  : getDefaultConfig({
      appName: 'PalengkePay',
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [morphHoodi],
      ssr: false,
    });

// Read-only client for view calls / log queries outside React (indexer, helpers).
export const publicClient = createPublicClient({
  chain: morphHoodi,
  transport: http(),
});
