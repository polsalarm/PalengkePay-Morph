import { defineChain } from 'viem';

// Central EVM network config — single source of truth. Replaces the old Stellar
// network.ts. Flip to mainnet by overriding the VITE_ vars below.

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 2910);

const RPC_URL =
  (import.meta.env.VITE_MORPH_RPC_URL as string | undefined) ?? 'https://rpc-hoodi.morph.network';

export const EXPLORER_URL =
  (import.meta.env.VITE_MORPH_EXPLORER as string | undefined) ?? 'https://explorer-hoodi.morph.network';

export const morphHoodi = defineChain({
  id: CHAIN_ID,
  name: 'Morph Hoodi',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Morph Hoodi Explorer', url: EXPLORER_URL } },
  testnet: true,
});

// ── Deployed contract addresses (Morph Hoodi, 2026-05-27) ──
export const PAYMENT_ADDRESS = import.meta.env.VITE_PALENGKE_PAYMENT_ADDRESS as `0x${string}` | undefined;
export const REGISTRY_ADDRESS = import.meta.env.VITE_VENDOR_REGISTRY_ADDRESS as `0x${string}` | undefined;
export const ESCROW_ADDRESS = import.meta.env.VITE_UTANG_ESCROW_ADDRESS as `0x${string}` | undefined;

export const contractsDeployed = !!(PAYMENT_ADDRESS && REGISTRY_ADDRESS && ESCROW_ADDRESS);

export function explorerTx(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
