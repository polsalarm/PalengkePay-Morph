import { type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from '../lib/config';

const queryClient = new QueryClient();

// EVM wallet stack (Morph Hoodi). Replaces the Stellar Wallets Kit provider.
// Connection state is read via useWallet() (wraps wagmi hooks); contract writes
// go through wagmi useWriteContract in the per-feature hooks.
export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
