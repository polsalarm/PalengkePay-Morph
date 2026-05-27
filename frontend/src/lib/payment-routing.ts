// On EVM there is no fee-bump/classic split — when the PalengkePayment address is
// configured we always settle through the contract; otherwise the app is unconfigured.
export type PaymentSettlementMode = 'contract' | 'fee-bump';

const WEI_PER_ETH = 1_000_000_000_000_000_000n;
const MAX_DECIMAL_PLACES = 18;

export function getPaymentContractId(): string | undefined {
  return import.meta.env.VITE_PALENGKE_PAYMENT_ADDRESS as string | undefined;
}

export function resolvePaymentSettlementMode(contractId?: string): PaymentSettlementMode {
  const configured = arguments.length === 0 ? getPaymentContractId() : contractId;
  return configured?.trim() ? 'contract' : 'fee-bump';
}

/** Parse an ETH decimal string to wei. Mirrors viem parseEther with explicit validation. */
export function ethToWei(amountEth: string): bigint {
  const trimmed = amountEth.trim();
  if (trimmed.startsWith('-')) throw new Error('amount must be greater than 0');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error('amount must be a valid ETH value');

  const [wholePart, rawFractionPart = ''] = trimmed.split('.');
  if (rawFractionPart.length > MAX_DECIMAL_PLACES) {
    throw new Error('amount supports at most 18 decimal places');
  }

  const fractionPart = rawFractionPart.padEnd(MAX_DECIMAL_PLACES, '0').slice(0, MAX_DECIMAL_PLACES);
  const wei = BigInt(wholePart) * WEI_PER_ETH + BigInt(fractionPart);
  if (wei <= 0n) throw new Error('amount must be greater than 0');
  return wei;
}
