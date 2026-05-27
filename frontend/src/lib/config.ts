import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { createPublicClient, http } from 'viem';
import { morphHoodi } from './chain';

// WalletConnect project id enables mobile/QR wallets. Injected (MetaMask) works
// without it; for WalletConnect set VITE_WALLETCONNECT_PROJECT_ID.
const WALLETCONNECT_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) || 'palengkepay-dev';

export const wagmiConfig = getDefaultConfig({
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
