import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
} from 'viem';

export interface PaymentFailureDetails {
  message: string;
  diagnostic: string | null;
}

// Custom errors declared by the PalengkePayment contract, mapped to user-facing text.
const CONTRACT_ERRORS: Record<string, PaymentFailureDetails> = {
  AmountMustBePositive: {
    message: 'Amount must be greater than 0',
    diagnostic: 'The peso amount is too small to settle at the current rate. Enter a larger amount.',
  },
  VendorTransferFailed: {
    message: 'Payment to vendor failed',
    diagnostic: 'The vendor wallet could not receive the transfer. Re-scan the vendor QR or verify the address.',
  },
  TokenRequired: {
    message: 'Stablecoin settlement misconfigured',
    diagnostic: 'Pick a valid stablecoin (or pay in ETH) and retry.',
  },
  SafeERC20FailedOperation: {
    message: 'Token transfer failed',
    diagnostic: 'Approve the token again, ensure you have enough balance, then retry.',
  },
  ReentrancyGuardReentrantCall: {
    message: 'Payment blocked by reentrancy guard',
    diagnostic: 'Retry the payment.',
  },
};

function decodeEvmError(err: BaseError): PaymentFailureDetails {
  if (err.walk((e) => e instanceof UserRejectedRequestError)) {
    return { message: 'Transaction cancelled — no funds sent', diagnostic: null };
  }

  const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (revert instanceof ContractFunctionRevertedError) {
    const name = revert.data?.errorName ?? null;
    if (name && CONTRACT_ERRORS[name]) return CONTRACT_ERRORS[name];
    return {
      message: name ? `Payment reverted: ${name}` : 'Payment reverted on-chain',
      diagnostic: revert.shortMessage?.slice(0, 240) ?? null,
    };
  }

  if (err.walk((e) => e instanceof InsufficientFundsError)) {
    return {
      message: 'Insufficient ETH for amount + gas',
      diagnostic: 'Top up testnet ETH via the faucet, then retry.',
    };
  }

  const raw = err.shortMessage ?? err.message;

  // Some wallets/RPCs return a bare "execution reverted" with no error data, so
  // the custom error (e.g. AmountMustBePositive) can't be decoded. The most
  // common causes here are a zero/too-small amount or a wrong-network wallet.
  if (/revert/i.test(raw)) {
    return {
      message: 'Payment reverted on-chain',
      diagnostic: 'Check the amount is greater than 0 and that your wallet is on Morph Hoodi (chain 2910), then retry.',
    };
  }

  return { message: raw.slice(0, 120), diagnostic: raw.slice(0, 240) };
}

type HorizonError = {
  response?: {
    data?: {
      extras?: {
        result_codes?: {
          transaction?: string;
          operations?: string[];
        };
      };
    };
  };
};

export function getPaymentFailureDetails(err: unknown): PaymentFailureDetails {
  if (!err) return { message: 'Unknown error', diagnostic: null };

  if (err instanceof BaseError) return decodeEvmError(err);

  const rc = (err as HorizonError).response?.data?.extras?.result_codes;
  if (rc) {
    const tx = rc.transaction;
    const ops = rc.operations ?? [];
    const diagnostic = `Revert data: ${[tx, ...ops].filter(Boolean).join(', ')}`;

    if (tx === 'tx_bad_seq') return { message: 'Sequence error — please try again', diagnostic };
    if (tx === 'tx_insufficient_fee') return { message: 'Network fee too low — please try again', diagnostic };
    if (tx === 'tx_bad_auth') return { message: 'Invalid signature — reconnect wallet', diagnostic };
    if (ops.includes('op_no_destination')) return { message: 'Vendor account not activated on Morph testnet', diagnostic };
    if (ops.includes('op_underfunded')) return { message: 'Insufficient ETH balance', diagnostic };
    if (ops.includes('op_low_reserve')) return { message: 'Account below minimum ETH reserve', diagnostic };

    return { message: `Transaction failed: ${tx ?? ops.join(', ') ?? 'unknown'}`, diagnostic };
  }

  const raw = (err as { message?: string }).message ?? String(err);
  const lower = raw.toLowerCase();

  if (raw.includes('Fee bump sponsor not configured')) {
    return {
      message: 'Gasless sponsorship is not configured',
      diagnostic: 'Set SPONSOR_SECRET on the fee-bump API environment, then retry the payment.',
    };
  }

  if (raw.includes('Too many fee-bump requests')) {
    return {
      message: 'Gasless sponsor is temporarily rate limited',
      diagnostic: 'Wait a minute, then retry. If this keeps happening, raise FEE_BUMP_RATE_LIMIT_MAX.',
    };
  }

  if (raw.includes('innerXdr required') || raw.includes('invalid innerXdr')) {
    return {
      message: 'Payment request was malformed',
      diagnostic: 'Re-scan the vendor QR or re-enter the payment details before retrying.',
    };
  }

  if (raw.includes('destination is not approved for sponsorship')) {
    return {
      message: 'Vendor is not approved for sponsored payments',
      diagnostic: 'Add this vendor wallet to FEE_BUMP_ALLOWED_DESTINATIONS or use an approved vendor.',
    };
  }

  if (raw.includes('Fee bump failed')) {
    return {
      message: 'Gasless sponsor failed',
      diagnostic: 'Retry once. If it fails again, verify the fee-bump API logs and sponsor account balance.',
    };
  }

  if (lower.includes('rejected') || lower.includes('cancel') || lower.includes('denied')) {
    return { message: 'Transaction cancelled — no funds sent', diagnostic: null };
  }
  if (lower.includes('network')) {
    return { message: 'Please switch to Morph Testnet', diagnostic: raw.slice(0, 160) };
  }
  if (lower.includes('balance') || lower.includes('insufficient')) {
    return { message: 'Insufficient ETH balance', diagnostic: raw.slice(0, 160) };
  }
  if (lower.includes('timeout')) {
    return { message: 'Transaction timed out — tap retry to resend', diagnostic: raw.slice(0, 160) };
  }

  return { message: raw.slice(0, 120), diagnostic: raw.length > 120 ? raw.slice(0, 240) : null };
}
