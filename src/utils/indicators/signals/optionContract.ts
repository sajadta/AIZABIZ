import type { RealOptionMetrics } from '../optionTypes';

export interface OptionContractInput {
  symbol: string;
  signalType: string;
  isStrongTechUptrend: boolean;
  isStrongTechDowntrend: boolean;
  totalBullishConfidence: number;
  totalBearishConfidence: number;
  corpScore: number;
  optionMetrics?: RealOptionMetrics;
  currentLtp: number;
  strikeStep: number;
  indexPrefix: string;
}

export interface OptionContract {
  isBullish: boolean;
  optType: 'CE' | 'PE';
  chosenStrike: number;
  optSymbol: string;
}

/** Chooses the option side, strike and tradable symbol for a generated signal. */
export function resolveOptionContract({
  symbol,
  signalType,
  isStrongTechUptrend,
  isStrongTechDowntrend,
  totalBullishConfidence,
  totalBearishConfidence,
  corpScore,
  optionMetrics,
  currentLtp,
  strikeStep,
  indexPrefix,
}: OptionContractInput): OptionContract {
  const symUpper = symbol.toUpperCase();
  const isBullish =
    signalType === 'BUY' ||
    (signalType === 'HOLD' &&
      (isStrongTechUptrend ||
        (!isStrongTechDowntrend &&
          totalBullishConfidence > totalBearishConfidence &&
          corpScore >= -15)));
  const optType: 'CE' | 'PE' =
    optionMetrics && Number(optionMetrics.ltp) > 0 && optionMetrics.optionType
      ? optionMetrics.optionType
      : isBullish
        ? 'CE'
        : 'PE';
  const defaultStrike = Math.round(currentLtp / strikeStep) * strikeStep;
  const chosenStrike = optionMetrics?.strikePrice || defaultStrike;

  let optSymbol = optionMetrics?.optionSymbol || '';
  if (
    !optSymbol &&
    (symUpper.includes('NIFTY') ||
      symUpper.includes('SENSEX') ||
      symUpper.includes('BANKEX') ||
      symUpper.includes('MIDCP'))
  ) {
    optSymbol = `${indexPrefix} ${chosenStrike} ${optType}`;
  }

  return { isBullish, optType, chosenStrike, optSymbol };
}
