import { formatEther, parseEther } from 'viem';
import {
  readContract as coreReadContract,
  writeContract as coreWriteContract,
  waitForTransactionReceipt as coreWaitForReceipt,
  getBalance as coreGetBalance,
  type WriteContractParameters,
} from '@wagmi/core';
import type { Abi } from 'viem';
import { wagmiConfig } from './config';
import { morphHoodi, EXPLORER_URL } from './chain';

// Core EVM helpers — replaces the Stellar SDK wrapper (stellar.ts). Reads go
// through the public client; writes go through the connected wallet via wagmi.
// All actions are bound to wagmiConfig + the Morph Hoodi chain.

export { formatEther, parseEther };

/** Native ETH balance of `address`, formatted to 4 dp (e.g. "0.0123"). */
export async function fetchBalance(address: string): Promise<string> {
  const { value } = await coreGetBalance(wagmiConfig, { address: address as `0x${string}` });
  return Number(formatEther(value)).toFixed(4);
}

/** Read-only view call. Throws on revert. */
export async function readContract<T = unknown>(
  address: `0x${string}`,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = []
): Promise<T> {
  return coreReadContract(wagmiConfig, {
    address,
    abi,
    functionName,
    args,
    chainId: morphHoodi.id,
  }) as Promise<T>;
}

/** Read-only view call that returns null instead of throwing on revert (e.g. "not found"). */
export async function readContractOrNull<T = unknown>(
  address: `0x${string}`,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = []
): Promise<T | null> {
  try {
    return await readContract<T>(address, abi, functionName, args);
  } catch {
    return null;
  }
}

/** State-changing call via the connected wallet. Returns the tx hash once mined (status success). */
export async function writeContract(params: {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}): Promise<string> {
  const hash = await coreWriteContract(wagmiConfig, {
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args ?? [],
    value: params.value,
    chainId: morphHoodi.id,
  } as WriteContractParameters);

  const receipt = await coreWaitForReceipt(wagmiConfig, { hash, chainId: morphHoodi.id });
  if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain');
  return hash;
}

// ── Display utilities ──────────────────────────────────────────────────────────

export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function explorerTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}

export function explorerAccountUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
