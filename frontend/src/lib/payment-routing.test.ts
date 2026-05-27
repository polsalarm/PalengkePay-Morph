import { describe, expect, it } from 'vitest';
import { resolvePaymentSettlementMode, ethToWei } from './payment-routing';

describe('resolvePaymentSettlementMode', () => {
  it('uses contract settlement when the PalengkePayment address is configured', () => {
    expect(resolvePaymentSettlementMode('0x49cfc8687afb94a2d3867713a7de829dc21794ca'))
      .toBe('contract');
  });

  it('falls back when no contract address is configured', () => {
    expect(resolvePaymentSettlementMode(undefined)).toBe('fee-bump');
    expect(resolvePaymentSettlementMode('')).toBe('fee-bump');
  });
});

describe('ethToWei', () => {
  it('converts ETH decimals to exact wei', () => {
    expect(ethToWei('1')).toBe(1_000_000_000_000_000_000n);
    expect(ethToWei('1.25')).toBe(1_250_000_000_000_000_000n);
    expect(ethToWei('0.000000000000000001')).toBe(1n);
  });

  it('rejects invalid or non-positive amounts', () => {
    expect(() => ethToWei('0')).toThrow('amount must be greater than 0');
    expect(() => ethToWei('-1')).toThrow('amount must be greater than 0');
    expect(() => ethToWei('abc')).toThrow('amount must be a valid ETH value');
    expect(() => ethToWei('1.0000000000000000001')).toThrow('amount supports at most 18 decimal places');
  });
});
