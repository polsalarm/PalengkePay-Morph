import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';

export interface WalletState {
  address: string | null;
  /** Native ETH balance, formatted (e.g. "0.0123"). Null until loaded. */
  balance: string | null;
  /** Connected wallet/connector name (e.g. "MetaMask"). */
  walletName: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  /** Opens the RainbowKit connect modal. */
  connect: () => void;
  disconnect: () => void;
  error: string | null;
}

// EVM wallet state, backed by wagmi + RainbowKit. Replaces the Stellar Wallets
// Kit context. Contract writes are no longer signed here — use the per-feature
// hooks (usePayment, useUtang, useVendor) which call wagmi writeContract.
export function useWallet(): WalletState {
  const { address, isConnected, isConnecting, connector } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const { data: bal } = useBalance({ address });

  return {
    address: address ?? null,
    balance: bal ? bal.formatted : null,
    walletName: connector?.name ?? null,
    isConnected,
    isConnecting,
    connect: () => openConnectModal?.(),
    disconnect: () => disconnect(),
    error: null,
  };
}
