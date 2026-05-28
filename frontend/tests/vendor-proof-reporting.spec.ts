import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';

// Must match E2E_TEST_ADDRESS in src/lib/config.ts (mock connector auto-connects to it).
const qaWallet = '0x1111111111111111111111111111111111111111';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((wallet) => {
    (window as unknown as { __PP_E2E__?: boolean }).__PP_E2E__ = true;
    window.localStorage.setItem(`pp_idx_${wallet}`, JSON.stringify({
      address: wallet,
      syncedAt: '2026-05-14T01:00:00.000Z',
      payments: [
        {
          id: 'qa-vendor-proof-hash',
          from: '0x3333333333333333333333333333333333333333',
          to: wallet,
          amountEth: 4.25,
          createdAt: '2026-05-14T01:00:00.000Z',
          memo: 'qa receipt',
        },
      ],
    }));
  }, qaWallet);
});

test('/vendor/transactions exposes income proof pack + recovery desk', async ({ page }, testInfo) => {
  await fs.mkdir('qa-artifacts/states', { recursive: true });
  await page.goto('/vendor/transactions');

  // Cached payment row (pp_idx_) renders even while on-chain reads resolve.
  const proofRow = page.getByRole('button', { name: /Open income proof pack for this transaction/i }).first();
  await expect(proofRow).toBeVisible({ timeout: 20_000 });

  // Recovery desk + cached transaction are on the page before opening any modal.
  await expect(page.getByText('qa-vendor-proof-hash').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Transaction Recovery Desk' })).toBeVisible();
  await expect(page.getByLabel('Lookup by hash/reference')).toBeVisible();

  // Open the income proof pack and assert its core contents.
  await proofRow.click();
  const proofModal = page.getByRole('dialog', { name: 'Income Proof Pack' });
  await expect(proofModal).toBeVisible({ timeout: 15_000 });
  await expect(proofModal.getByRole('heading', { name: 'Income Proof Pack' })).toBeVisible();
  await expect(proofModal.getByText(/Testnet exports are demo evidence/i)).toBeVisible();
  await expect(proofModal.getByRole('button', { name: /CSV/i })).toBeVisible();
  await expect(proofModal.getByRole('button', { name: /JSON/i })).toBeVisible();
  await expect(proofModal.getByRole('button', { name: /Certificate/i })).toBeVisible();

  await page.screenshot({
    path: `qa-artifacts/states/${testInfo.project.name}-vendor-transactions-proof-recovery.png`,
    animations: 'disabled',
    fullPage: false,
  });
});

test('/vendor/utang exposes collections reporting summary', async ({ page }) => {
  await page.goto('/vendor/utang');

  await expect(page.getByRole('heading', { name: 'Collections Report' })).toBeVisible();
  await expect(page.getByText(/Summary of active, completed|Buod ng aktibo/i)).toBeVisible();
  await expect(page.getByText('Outstanding')).toBeVisible();
  await expect(page.getByText('Collected')).toBeVisible();
});
