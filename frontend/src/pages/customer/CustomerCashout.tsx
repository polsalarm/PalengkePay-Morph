import { useState } from 'react';
import { ArrowUpFromLine, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useBalance } from '../../lib/hooks/useBalance';
import { useToast } from '../../lib/hooks/useToast';
import { WalletRequiredState } from '../../components/WalletRequiredState';
import { openTransak, transakConfigured } from '../../lib/transak';

export function CustomerCashout() {
  const { address } = useWallet();
  const { balance, refetch } = useBalance(address);
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!address) return <WalletRequiredState detail="Connect your wallet to cash out to PHP." />;

  const launch = () => {
    if (!transakConfigured) {
      showToast('Cash-out not configured — set VITE_TRANSAK_API_KEY', 'error');
      return;
    }
    setBusy(true);
    openTransak({
      product: 'SELL',
      walletAddress: address,
      onSuccess: () => { showToast('Sell order placed! PHP payout processing.', 'success'); refetch(); },
      onClose: () => setBusy(false),
    });
  };

  return (
    <div className="max-w-md mx-auto space-y-4 animate-page-in">
      <div className="relative rounded-3xl overflow-hidden p-5" style={{ backgroundColor: '#00284B' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <ArrowUpFromLine size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-black text-white mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>Cash Out</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Sell ETH for PHP via Transak. Payout to your bank or e-wallet.</p>
        <p className="text-xs font-mono mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Balance: {balance ?? '—'} ETH</p>
      </div>

      {!transakConfigured && (
        <div className="rounded-2xl p-4 flex gap-3" style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <AlertTriangle size={18} style={{ color: '#D97706' }} className="shrink-0" />
          <p className="text-xs" style={{ color: '#92400E' }}>
            Transak not configured. Set <code className="font-mono">VITE_TRANSAK_API_KEY</code> (and a supported
            <code className="font-mono"> VITE_TRANSAK_NETWORK</code>) in <code className="font-mono">.env.local</code>.
          </p>
        </div>
      )}

      <button
        onClick={launch}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 font-black rounded-2xl text-white active:scale-95 disabled:opacity-60"
        style={{ backgroundColor: '#008055', minHeight: '52px', fontFamily: "'Montserrat', sans-serif" }}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpFromLine size={16} />}
        {busy ? 'Opening Transak…' : 'Sell ETH for PHP'}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck size={12} /> Powered by Transak · KYC handled by provider
      </p>
    </div>
  );
}
