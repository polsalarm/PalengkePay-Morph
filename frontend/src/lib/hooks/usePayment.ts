import { useState, useCallback } from 'react';
import { sendPayment as sendPaymentTx, sendStablePayment, contractsDeployed } from '../contracts';
import { getPaymentFailureDetails } from '../payment-diagnostics';
import type { PaymentSettlementMode } from '../payment-routing';
import { NATIVE_TOKEN, type PayToken } from '../tokens';

export type TxStatus = 'idle' | 'building' | 'signing' | 'approving' | 'minting' | 'submitting' | 'confirmed' | 'failed';

export interface PaymentState {
  status: TxStatus;
  txHash: string | null;
  error: string | null;
  diagnostic: string | null;
}

// EVM payment hook. Native ETH goes through PalengkePayment.pay (msg.value); ERC-20
// stablecoins go through payToken with an approve→pay two-step (the 'approving' status
// surfaces the extra wallet prompt). The connected wallet is always the payer, so the
// `from` arg is accepted for call-site compatibility.
export function usePayment() {
  const settlementMode: PaymentSettlementMode = contractsDeployed ? 'contract' : 'fee-bump';
  const [state, setState] = useState<PaymentState>({
    status: 'idle', txHash: null, error: null, diagnostic: null,
  });

  const sendPayment = useCallback(async (
    from: string,
    to: string,
    amount: string,
    memo?: string,
    token: PayToken = NATIVE_TOKEN,
  ) => {
    try {
      setState({ status: 'submitting', txHash: null, error: null, diagnostic: null });
      const { txHash } = token.kind === 'native'
        ? await sendPaymentTx(to, amount, memo ?? '')
        : await sendStablePayment(from, to, token, amount, memo ?? '', {
            onMinting: () => setState({ status: 'minting', txHash: null, error: null, diagnostic: null }),
            onApproving: () => setState({ status: 'approving', txHash: null, error: null, diagnostic: null }),
          });
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
