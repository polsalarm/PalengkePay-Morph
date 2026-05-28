import { useState } from 'react';
import { ArrowDownToLine, Loader2, CheckCircle, Info } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useBalance } from '../../lib/hooks/useBalance';
import { usePhpRate } from '../../lib/hooks/usePhpRate';
import { formatPhp } from '../../lib/rate';
import { recordRamp, type MockRampTxn } from '../../lib/mockRamp';
import { openTransak, transakConfigured } from '../../lib/transak';
import { WalletRequiredState } from '../../components/WalletRequiredState';

export function CustomerCashin() {
  const { address } = useWallet();
  const { balance, refetch } = useBalance(address);
  const { rate } = usePhpRate();
  const [php, setPhp] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<MockRampTxn | null>(null);

  if (!address) return <WalletRequiredState detail="Connect your wallet to cash in with PHP." />;

  const phpNum = parseFloat(php) || 0;
  const eth = rate > 0 ? phpNum / rate : 0;

  const confirm = () => {
    if (phpNum <= 0) return;
    setBusy(true);
    // Simulated settlement delay
    setTimeout(() => {
      const txn = recordRamp('cashin', phpNum, eth, rate);
      setDone(txn);
      setBusy(false);
      refetch();
    }, 1200);
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto space-y-4 animate-page-in">
        <div className="rounded-3xl p-6 text-center" style={{ background: 'linear-gradient(135deg, #00284B, #008055)' }}>
          <CheckCircle size={44} className="text-white mx-auto mb-3" />
          <h2 className="text-xl font-black text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>Cash-in complete</h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{formatPhp(done.php)} → {done.eth.toFixed(6)} ETH</p>
          <p className="text-xs font-mono mt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>Ref {done.ref} · Demo</p>
        </div>
        <button onClick={() => { setDone(null); setPhp(''); }} className="w-full font-black rounded-2xl text-white active:scale-95" style={{ backgroundColor: '#008055', minHeight: 52 }}>Cash in again</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4 animate-page-in">
      <div className="rounded-3xl overflow-hidden p-5" style={{ backgroundColor: '#00284B' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <ArrowDownToLine size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-black text-white mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>Cash In</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Convert PHP to ETH in your wallet.</p>
        <p className="text-xs font-mono mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Balance: {balance ?? '—'} ETH · ₱{rate.toLocaleString()} / ETH</p>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-white">
        <label className="text-xs font-bold text-slate-500">Amount (PHP)</label>
        <input
          type="number" inputMode="decimal" value={php} onChange={(e) => setPhp(e.target.value)}
          placeholder="500"
          className="w-full text-2xl font-black rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#008055]"
        />
        <p className="text-sm text-slate-500">You receive ≈ <span className="font-bold text-slate-900">{eth.toFixed(6)} ETH</span></p>
      </div>

      <div className="rounded-xl p-3 flex gap-2 text-xs" style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}>
        <Info size={14} className="shrink-0 mt-0.5" />
        <span>Demo cash-in — simulated PHP payment, no real funds. Real fiat ramps don't support testnet ETH.</span>
      </div>

      <button
        onClick={confirm} disabled={busy || phpNum <= 0}
        className="w-full flex items-center justify-center gap-2 font-black rounded-2xl text-white active:scale-95 disabled:opacity-50"
        style={{ backgroundColor: '#008055', minHeight: 52, fontFamily: "'Montserrat', sans-serif" }}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
        {busy ? 'Processing…' : 'Confirm cash-in (Demo)'}
      </button>

      {transakConfigured && (
        <button
          onClick={() => openTransak({ product: 'BUY', walletAddress: address, fiatAmount: phpNum || undefined })}
          className="w-full text-xs font-bold text-slate-500 underline"
        >
          Or use Transak (real provider · supported chains only)
        </button>
      )}
    </div>
  );
}
