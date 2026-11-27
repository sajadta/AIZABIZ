/**
 * optionTradeRules.ts
 * Pure, decoupled rules for Options-Only trading execution and genuine profitability verification.
 */

export { enforceOptionsOnlyConfig } from './optionTradeRules/config';
export type {
  OptionProfitabilityParams,
  OptionProfitabilityResult,
} from './optionTradeRules/profitability';
export { evaluateOptionTradeProfitability } from './optionTradeRules/profitability';
export type { CapitalTierName, CapitalTierOptionConstraints } from './optionTradeRules/capitalTier';
export { getCapitalTierOptionConstraints } from './optionTradeRules/capitalTier';
export type { DipMomentumInput } from './optionTradeRules/dipMomentum';
export { evaluateOptionDipMomentum } from './optionTradeRules/dipMomentum';
export type {
  PaperOrderValidationInput,
  PaperOrderValidationResult,
} from './optionTradeRules/paperOrder';
export { validatePaperOrderInput } from './optionTradeRules/paperOrder';
