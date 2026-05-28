import { useState } from 'react';
import { ArrowUpFromLine, Loader2, CheckCircle, Info } from 'lucide-react';
import { useWallet } from '../../lib/hooks/useWallet';
import { useBalance } from '../../lib/hooks/useBalance';
import { usePhpRate } from '../../lib/hooks/usePhpRate';
import { formatPhp } from '../../lib/rate';
import { recordRamp, type MockRampTxn } from '../../lib/mockRamp';
import { openTransak, transakConfigured } from '../../lib/transak';
import { WalletRequiredState } from '../../components/WalletRequiredState';

export function CustomerCashout() {
  const { address } = useWallet();
  const { balance, refetch } = useBalance(address);
  const { rate } = usePhpRate();
  const [eth, setEth] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<MockRampTxn | null>(null);

  if (!address) return <WalletRequiredState detail="Connect your wallet to cash out to PHP." />;

  const ethNum = parseFloat(eth) || 0;
  const php = ethNum * rate;
  const bal = balance ? parseFloat(balance) : 0;
  const overBalance = ethNum > bal;

  const confirm = () => {
    if (ethNum <= 0 || overBalance) return;
    setBusy(true);
    setTimeout(() => {
      const txn = recordRamp('cashout', php, ethNum, rate);
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
          <h2 className="text-xl font-black text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>Cash-out sent</h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{done.eth.toFixed(6)} ETH → {formatPhp(done.php)}</p>
          <p className="text-xs font-mono mt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>Ref {done.ref} · Demo payout</p>
        </div>
        <button onClick={() => { setDone(null); setEth(''); }} className="w-full font-black rounded-2xl text-white active:scale-95" style={{ backgroundColor: '#008055', minHeight: 52 }}>Cash out again</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-4 animate-page-in">
      <div className="rounded-3xl overflow-hidden p-5" style={{ backgroundColor: '#00284B' }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <ArrowUpFromLine size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-black text-white mb-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>Cash Out</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>Convert ETH to PHP payout.</p>
        <p className="text-xs font-mono mt-4" style={{ color: 'rgba(255,255,255,0.4)' }}>Balance: {balance ?? '—'} ETH · ₱{rate.toLocaleString()} / ETH</p>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-500">Amount (ETH)</label>
          <button onClick={() => setEth(String(bal))} className="text-xs font-bold text-[#008055]">Max</button>
        </div>
        <input
          type="number" inputMode="decimal" value={eth} onChange={(e) => setEth(e.target.value)}
          placeholder="0.01"
          className="w-full text-2xl font-black rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#008055]"
        />
        <p className="text-sm text-slate-500">You receive ≈ <span className="font-bold text-slate-900">{formatPhp(php)}</span></p>
        {overBalance && <p className="text-xs font-bold text-rose-600">Exceeds balance ({bal.toFixed(6)} ETH)</p>}
      </div>

      <div className="rounded-xl p-3 flex gap-2 text-xs" style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}>
        <Info size={14} className="shrink-0 mt-0.5" />
        <span>Demo cash-out — simulated PHP payout, no real funds move. Testnet ETH has no fiat value.</span>
      </div>

      <button
        onClick={confirm} disabled={busy || ethNum <= 0 || overBalance}
        className="w-full flex items-center justify-center gap-2 font-black rounded-2xl text-white active:scale-95 disabled:opacity-50"
        style={{ backgroundColor: '#008055', minHeight: 52, fontFamily: "'Montserrat', sans-serif" }}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpFromLine size={16} />}
        {busy ? 'Processing…' : 'Confirm cash-out (Demo)'}
      </button>

      {transakConfigured && (
        <button
          onClick={() => openTransak({ product: 'SELL', walletAddress: address })}
          className="w-full text-xs font-bold text-slate-500 underline"
        >
          Or use Transak (real provider · supported chains only)
        </button>
      )}
    </div>
  );
}
