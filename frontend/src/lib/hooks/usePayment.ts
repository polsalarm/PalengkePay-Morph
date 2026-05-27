import { useState, useCallback } from 'react';
import { sendPayment as sendPaymentTx, contractsDeployed } from '../contracts';
import { getPaymentFailureDetails } from '../payment-diagnostics';
import type { PaymentSettlementMode } from '../payment-routing';

export type TxStatus = 'idle' | 'building' | 'signing' | 'submitting' | 'confirmed' | 'failed';

export interface PaymentState {
  status: TxStatus;
  txHash: string | null;
  error: string | null;
  diagnostic: string | null;
}

// EVM payment hook. msg.value carries the ETH; the connected wallet is the payer,
// so the `from` arg is accepted for call-site compatibility but not used on-chain.
export function usePayment() {
  const settlementMode: PaymentSettlementMode = contractsDeployed ? 'contract' : 'fee-bump';
  const [state, setState] = useState<PaymentState>({
    status: 'idle', txHash: null, error: null, diagnostic: null,
  });

  const sendPayment = useCallback(async (
    _from: string,
    to: string,
    amount: string,
    memo?: string,
    _opts?: { forceClassic?: boolean }
  ) => {
    try {
      setState({ status: 'submitting', txHash: null, error: null, diagnostic: null });
      const { txHash } = await sendPaymentTx(to, amount, memo ?? '');
      setState({ status: 'confirmed', txHash, error: null, diagnostic: null });
    } catch (err: unknown) {
      const details = getPaymentFailureDetails(err);
      setState({ status: 'failed', txHash: null, error: details.message, diagnostic: details.diagnostic });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', txHash: null, error: null, diagnostic: null });
  }, []);

  return { ...state, settlementMode, sendPayment, reset };
}
