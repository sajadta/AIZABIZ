// Validation of paper-trade order inputs before execution.
export interface PaperOrderValidationInput {
  symbol: string;
  resolvedKey: string;
  price: number;
}

export interface PaperOrderValidationResult {
  valid: boolean;
  isOption: boolean;
  error?: string;
}

/**
 * Validates paper trade orders:
 * - Rejects zero or non-finite order prices.
 * - Strictly detects option contracts via CE/PE tokens (NOT broad "FO" substring, which broke Futures).
 * - Blocks dummy ₹100 fallback option orders that lack a verified numeric Upstox option key,
 *   while allowing real-LTP paper Option Chain contracts and all Futures/Equity orders.
 */
export function validatePaperOrderInput(
  input: PaperOrderValidationInput,
): PaperOrderValidationResult {
  const symbol = String(input.symbol || '');
  const resolvedKey = String(input.resolvedKey || '');
  const price = Number(input.price);
  const isOption = /\b(CE|PE)\b/i.test(symbol) || /(CE|PE)$/i.test(resolvedKey);

  if (!Number.isFinite(price) || price <= 0) {
    return {
      valid: false,
      isOption,
      error: 'Order price must be greater than ₹0.',
    };
  }

  if (isOption && price === 100 && !resolvedKey.match(/^(NSE_FO|BSE_FO)\|\d+/)) {
    return {
      valid: false,
      isOption,
      error: 'Blocked dummy ₹100 option order without real Upstox option chain contract.',
    };
  }

  return { valid: true, isOption };
}
