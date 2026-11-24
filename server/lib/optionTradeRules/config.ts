// Strict OPTIONS_ONLY configuration enforcement.

/**
 * Enforces the strict OPTIONS_ONLY mode and high-conviction quality thresholds.
 */
export function enforceOptionsOnlyConfig(config: any): any {
  if (!config || typeof config !== 'object') return config;
  config.tradeMode = 'OPTIONS_ONLY';
  config.minConfidence = Math.max(85, Number(config.minConfidence || 85));
  config.minOptionProfitAmount = Math.max(350, Number(config.minOptionProfitAmount || 350));
  config.optionStrikeSelector = true;
  return config;
}
