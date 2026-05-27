// Seed the live Morph Hoodi contracts with demo data using REAL generated wallets.
//
//   cd frontend && node scripts/seed.mjs
//
// Flow: admin (deployer) registers vendors -> funds fresh customer wallets from the
// deployer -> customers pay vendors -> one customer opens a utang and pays an
// installment. Generated wallets (with private keys) are written to
// scripts/seed-wallets.json (gitignored). Reads DEPLOYER_KEY + RPC from
// contracts-evm/.env and ABIs from contracts-evm/out.
//
// NOTE: Morph Hoodi's sequencer floor is ~0.2 gwei and viem's 1559 estimate off the
// tiny base fee underprices txs (they hang). Every tx forces legacy gasPrice = 1 gwei.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseGwei, defineChain, keccak256, toBytes } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const commentHash = (s) => keccak256(toBytes(s)); // off-chain comment -> bytes32

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const EVM = path.join(ROOT, 'contracts-evm');

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = parseEnv(path.join(EVM, '.env'));
const RPC = env.MORPH_HOODI_RPC || 'https://rpc-hoodi.morph.network';
const DEPLOYER_KEY = (env.DEPLOYER_KEY || process.env.DEPLOYER_KEY || '').trim();
if (!/^0x[0-9a-fA-F]{64}$/.test(DEPLOYER_KEY)) {
  console.error('DEPLOYER_KEY missing/invalid in contracts-evm/.env'); process.exit(1);
}

const ADDR = {
  payment: '0x49cfc8687afb94a2d3867713a7de829dc21794ca',
  registry: '0xa1aba560607d756096f28f35c5127ce3a05f3032',
  escrow: '0x0db57bc80d2687137b7b0fb434bdb1c93b6ea229',
};
const abiOf = (c) => JSON.parse(fs.readFileSync(path.join(EVM, 'out', `${c}.sol`, `${c}.json`), 'utf8')).abi;
const paymentAbi = abiOf('PalengkePayment');
const registryAbi = abiOf('VendorRegistry');
const escrowAbi = abiOf('UTangEscrow');

const chain = defineChain({
  id: 2910, name: 'Morph Hoodi',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const GAS = { gasPrice: parseGwei('1') }; // legacy, above the ~0.2 gwei floor

const pub = createPublicClient({ chain, transport: http(RPC) });
const admin = privateKeyToAccount(DEPLOYER_KEY);
const adminWallet = createWalletClient({ account: admin, chain, transport: http(RPC) });

async function mined(hash) {
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== 'success') throw new Error(`tx reverted: ${hash}`);
  return r;
}
async function write(wallet, address, abi, functionName, args, value) {
  const hash = await wallet.writeContract({ address, abi, functionName, args, value, ...GAS });
  await mined(hash);
  console.log(`    ✓ ${functionName} ${hash}`);
  return hash;
}
const newWallet = (label) => {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  return { label, pk, address: account.address, account };
};

const VENDOR_SEEDS = [
  { name: 'Aling Maria Fish', stall: '12', phone: '0917', product: 'fish' },
  { name: 'Mang Ben Gulay', stall: '08', phone: '0918', product: 'vegetables' },
];

async function main() {
  const bal = await pub.getBalance({ address: admin.address });
  console.log(`Admin ${admin.address} balance: ${formatEther(bal)} ETH`);
  const NEED = parseEther('0.003');
  if (bal < NEED) {
    console.error(`\nLow balance. Need ~${formatEther(NEED)} ETH. Fund the deployer at`);
    console.error(`https://morph-rails-hoodi.morph.network/faucet?address=${admin.address}\n`);
    process.exit(1);
  }

  const vendors = VENDOR_SEEDS.map((_, i) => newWallet(`vendor${i}`));
  const customers = [newWallet('customer0'), newWallet('customer1')];

  console.log('\n[1/4] Registering vendors (admin)…');
  for (let i = 0; i < vendors.length; i++) {
    const v = vendors[i], s = VENDOR_SEEDS[i];
    await write(adminWallet, ADDR.registry, registryAbi, 'registerVendor',
      [v.address, 'marikina-public-market', s.name, s.stall, s.phone, s.product]);
  }

  console.log('\n[2/4] Funding customer wallets…');
  for (const c of customers) {
    const hash = await adminWallet.sendTransaction({ to: c.address, value: parseEther('0.001'), ...GAS });
    await mined(hash);
    console.log(`    ✓ funded ${c.label} ${c.address}`);
  }

  console.log('\n[3/5] Customer payments…');
  const c0 = createWalletClient({ account: customers[0].account, chain, transport: http(RPC) });
  const payHash0 = await write(c0, ADDR.payment, paymentAbi, 'pay', [vendors[0].address, 'gulay at isda'], parseEther('0.0002'));
  const payHash1 = await write(c0, ADDR.payment, paymentAbi, 'pay', [vendors[1].address, 'bigas'], parseEther('0.00015'));

  console.log('\n[4/5] Utang: create + pay first installment…');
  const c1 = createWalletClient({ account: customers[1].account, chain, transport: http(RPC) });
  await write(c1, ADDR.escrow, escrowAbi, 'createUtang',
    [vendors[1].address, parseEther('0.0006'), 3, 7n * 86400n, 'sako bigas 25kg']);
  const id = await pub.readContract({ address: ADDR.escrow, abi: escrowAbi, functionName: 'utangCount' });
  // installment = ceil(0.0006/3) = 0.0002; +1% reserve
  const value = parseEther('0.0002') + (parseEther('0.0002') * 100n) / 10_000n;
  await write(c1, ADDR.escrow, escrowAbi, 'payInstallment', [id], value);

  console.log('\n[5/5] Ratings (customer0 rates the vendors it paid)…');
  await write(c0, ADDR.registry, registryAbi, 'submitRating',
    [vendors[0].address, payHash0, 5, commentHash('Sariwa ang isda, mabilis maglingkod!')]);
  await write(c0, ADDR.registry, registryAbi, 'submitRating',
    [vendors[1].address, payHash1, 4, commentHash('Maganda ang bigas, sulit sa presyo')]);

  const outFile = path.join(__dirname, 'seed-wallets.json');
  fs.writeFileSync(outFile, JSON.stringify({
    network: 'morph-hoodi', chainId: 2910, generatedAt: new Date().toISOString(),
    vendors: vendors.map((v, i) => ({ ...VENDOR_SEEDS[i], address: v.address, privateKey: v.pk })),
    customers: customers.map((c) => ({ label: c.label, address: c.address, privateKey: c.pk })),
  }, null, 2));

  console.log(`\nDone. Seeded utang #${id}. Wallets (with keys) -> scripts/seed-wallets.json (gitignored).`);
  console.log('Explorer:');
  console.log(`  payment  https://explorer-hoodi.morph.network/address/${ADDR.payment}`);
  console.log(`  vendor0  https://explorer-hoodi.morph.network/address/${vendors[0].address}`);
}

main().catch((e) => { console.error('\nSeed failed:', e.shortMessage ?? e.message ?? e); process.exit(1); });
