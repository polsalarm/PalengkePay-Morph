import { expect, test } from '@playwright/test';

// Must match E2E_TEST_ADDRESS in src/lib/config.ts (mock connector auto-connects to it).
const customerWallet = '0x1111111111111111111111111111111111111111';
const vendorWallet = '0x2222222222222222222222222222222222222222';

test('/customer/history shows preserved PHP receipt proof from signed payments', async ({ page }) => {
  await page.addInitScript(({ customer, vendor }) => {
    (window as unknown as { __PP_E2E__?: boolean }).__PP_E2E__ = true;
    window.localStorage.setItem(`pp_idx_${customer}`, JSON.stringify({
      address: customer,
      payments: [
        {
          id: 'tx-live-hash',
          from: customer,
          to: vendor,
          amountXlm: 20,
          createdAt: '2026-05-14T01:00:30.000Z',
          memo: 'E2E smoke',
        },
      ],
      syncedAt: '2026-05-14T01:02:00.000Z',
    }));
    window.localStorage.setItem(`pp_payment_proofs_${customer}`, JSON.stringify([
      {
        txHash: 'tx-live-hash',
        from: customer,
        to: vendor,
        amountXlm: 20,
        createdAt: '2026-05-14T01:00:31.000Z',
        memo: 'E2E smoke',
        settlementMode: 'contract',
        quote: {
          phpAmount: 125,
          phpPerXlm: 6.25,
          xlmAmount: '20.0000000',
          generatedAt: '2026-05-14T01:00:00.000Z',
          expiresAt: '2026-05-14T01:01:00.000Z',
          source: 'api',
        },
      },
    ]));
  }, { customer: customerWallet, vendor: vendorWallet });

  await page.goto('/customer/history');

  await expect(page.getByText('E2E smoke')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('₱125.00')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('₱6.25/ETH')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: /Open receipt tx-live-hash/i })).toBeVisible({ timeout: 15_000 });
});
