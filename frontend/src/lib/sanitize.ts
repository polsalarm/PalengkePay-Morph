/** Strip HTML tags and trim. Use on all user-supplied string inputs before storing or displaying. */
export function sanitizeText(value: string, maxLen = 200): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'`]/g, '')
    .trim()
    .slice(0, maxLen);
}

/** Validate an EVM address (0x + 40 hex). */
export function isEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}

/** Validate a positive ETH amount string (up to 18 decimal places). */
export function isValidEthAmount(value: string): boolean {
  return /^\d+(\.\d{1,18})?$/.test(value.trim()) && parseFloat(value) > 0;
}

/** Sanitize memo field: ASCII printable, max 64 chars. */
export function sanitizeMemo(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, 64);
}
