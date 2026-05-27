// One-off: seed RATINGS on the existing seeded data (run after seed.mjs, when a full
// re-seed isn't worth it). Reads scripts/seed-wallets.json for customer0, finds the
// vendors it paid via PaymentCompleted logs, tops up its gas from the admin, then
// submits a rating per payment. Idempotent: skips already-rated (vendor, txHash).
//
//   cd frontend && node scripts/seed-ratings.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseGwei, keccak256, toBytes, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVM = path.resolve(__dirname, '../../contracts-evm');

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}
const env = parseEnv(path.join(EVM, '.env'));
const RPC = env.MORPH_HOODI_RPC || 'https://rpc-hoodi.morph.network';
const ADDR = {
  payment: '0x49cfc8687afb94a2d3867713a7de829dc21794ca',
  registry: '0xa1aba560607d756096f28f35c5127ce3a05f3032',
};
const abiOf = (c) => JSON.parse(fs.readFileSync(path.join(EVM, 'out', `${c}.sol`, `${c}.json`), 'utf8')).abi;
const paymentAbi = abiOf('PalengkePayment');
const registryAbi = abiOf('VendorRegistry');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-wallets.json'), 'utf8'));
const chain = defineChain({ id: 2910, name: 'Morph Hoodi', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const GAS = { gasPrice: parseGwei('1') };
const pub = createPublicClient({ chain, transport: http(RPC) });
const admin = privateKeyToAccount(env.DEPLOYER_KEY.trim());
const adminWallet = createWalletClient({ account: admin, chain, transport: http(RPC) });

const RATINGS = [5, 4, 5, 3]; // assigned in order of payments found
const COMMENTS = ['Sariwa, mabilis!', 'Sulit sa presyo', 'Laging maganda', 'Ok naman'];

async function mined(h) { const r = await pub.waitForTransactionReceipt({ hash: h }); if (r.status !== 'success') throw new Error('reverted ' + h); return r; }

async function main() {
  const c = seed.customers[0];
  const account = privateKeyToAccount(c.privateKey);
  const wallet = createWalletClient({ account, chain, transport: http(RPC) });
  console.log(`Rating from customer0 ${c.address}`);

  // ensure customer0 has gas
  const bal = await pub.getBalance({ address: account.address });
  if (bal < parseEther('0.0003')) {
    console.log('  topping up customer0 gas from admin…');
    const h = await adminWallet.sendTransaction({ to: account.address, value: parseEther('0.0004'), ...GAS });
    await mined(h);
  }

  // find the vendors customer0 paid (PaymentCompleted logs carry the tx hash = rating key).
  // Morph RPC caps eth_getLogs range — query a bounded recent window.
  const latest = await pub.getBlockNumber();
  const fromBlock = latest > 4999n ? latest - 4999n : 0n; // Morph eth_getLogs cap = 5000 blocks
  const logs = await pub.getContractEvents({
    address: ADDR.payment, abi: paymentAbi, eventName: 'PaymentCompleted',
    args: { customer: account.address }, fromBlock, toBlock: 'latest',
  });
  if (logs.length === 0) { console.log('  no payments found for customer0 — run seed.mjs first.'); return; }

  let i = 0;
  for (const log of logs) {
    const vendor = log.args.vendor;
    const txHash = log.transactionHash; // bytes32 rating key
    const already = await pub.readContract({ address: ADDR.registry, abi: registryAbi, functionName: 'hasRated', args: [vendor, txHash] });
    if (already) { console.log(`  • ${vendor} already rated, skip`); continue; }
    const stars = RATINGS[i % RATINGS.length];
    const h = await wallet.writeContract({
      address: ADDR.registry, abi: registryAbi, functionName: 'submitRating',
      args: [vendor, txHash, stars, keccak256(toBytes(COMMENTS[i % COMMENTS.length]))], ...GAS,
    });
    await mined(h);
    console.log(`  ✓ rated ${vendor} ${stars}★  ${h}`);
    i++;
  }

  // show resulting aggregates
  for (const v of seed.vendors) {
    const [sum, count] = await pub.readContract({ address: ADDR.registry, abi: registryAbi, functionName: 'getVendorRating', args: [v.address] });
    console.log(`  ${v.name}: ${count > 0 ? (Number(sum) / Number(count)).toFixed(2) : '—'} avg (${count} ratings)`);
  }
  console.log(`Admin balance now: ${formatEther(await pub.getBalance({ address: admin.address }))} ETH`);
}

main().catch((e) => { console.error('Failed:', e.shortMessage ?? e.message ?? e); process.exit(1); });
