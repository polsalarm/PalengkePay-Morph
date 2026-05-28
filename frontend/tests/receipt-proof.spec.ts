import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

const customerWallet = '0x1111111111111111111111111111111111111111';
const vendorWallet = '0x2222222222222222222222222222222222222222';

test('standalone receipt route restores saved wallet proof by transaction hash', async ({ page }, testInfo) => {
  await page.addInitScript(({ customer, vendor }) => {
    (window as unknown as { __PP_E2E__?: boolean }).__PP_E2E__ = true;
    window.localStorage.setItem(`pp_payment_proofs_${customer}`, JSON.stringify([
      {
        txHash: 'tx-live-hash',
        from: customer,
        to: vendor,
        amountEth: 20,
        memo: 'E2E smoke',
        createdAt: '2026-05-14T01:00:31.000Z',
        settlementMode: 'contract',
        quote: {
          phpAmount: 125,
          phpPerEth: 6.25,
          xlmAmount: '20.0000000',
          generatedAt: '2026-05-14T01:00:00.000Z',
          expiresAt: '2026-05-14T01:01:00.000Z',
          source: 'api',
        },
      },
    ]));
  }, { customer: customerWallet, vendor: vendorWallet });

  await page.goto('/receipt/tx-live-hash');

  await expect(page.getByRole('heading', { name: 'Payment receipt' })).toBeVisible();
  await expect(page.getByText('Wallet-signed Testnet proof saved on this device')).toBeVisible();
  await expect(page.getByText('₱125.00')).toBeVisible();
  await expect(page.getByText('20 ETH')).toBeVisible();
  await expect(page.getByText('tx-live-hash')).toBeVisible();
  await expect(page.getByRole('link', { name: /Verify on Morph Explorer/i })).toBeVisible();

  await fs.mkdir('qa-artifacts/states', { recursive: true });
  await page.screenshot({
    path: `qa-artifacts/states/${testInfo.project.name}-receipt-proof.png`,
    fullPage: true,
  });
});
