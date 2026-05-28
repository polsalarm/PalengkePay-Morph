import { useEffect, type ReactNode } from 'react';
import { WagmiProvider, useAccount, useConnect } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig, isE2E } from '../lib/config';

const queryClient = new QueryClient();

// In E2E mode, auto-connect the mock connector so wallet-gated pages render.
function E2EAutoConnect() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  useEffect(() => {
    if (!isConnected && connectors[0]) connect({ connector: connectors[0] });
  }, [isConnected, connectors, connect]);
  return null;
}

// EVM wallet stack (Morph Hoodi). Replaces the Stellar Wallets Kit provider.
// Connection state is read via useWallet() (wraps wagmi hooks); contract writes
// go through wagmi useWriteContract in the per-feature hooks.
export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {isE2E && <E2EAutoConnect />}
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
