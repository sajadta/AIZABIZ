// Cross-index sector veto: BANKEX tracks the same banking heavyweights as
// NIFTY BANK, so a bearish BankNifty must block BANKEX calls (and vice versa).

export interface CrossIndexVetoParams {
  symbol: string;
  signal: any;
  bankQuote: any;
  corporateHeavyweightScore: number;
}

export function applyCrossIndexVeto({
  symbol,
  signal,
  bankQuote,
  corporateHeavyweightScore,
}: CrossIndexVetoParams): void {
  // CRITICAL CROSS-INDEX SECTOR VETO:
  // BANKEX is BSE counterpart of NSE NIFTY BANK (identical constituent stocks: HDFCBANK, ICICIBANK, SBIN, AXISBANK, KOTAKBANK).
  // If BankNifty is Bearish / Red on the day, NEVER buy a BANKEX CE!
  // If BankNifty is Bullish / Green on the day, NEVER buy a BANKEX PE!
  if (symbol === 'BANKEX' && signal && signal.signalType !== 'HOLD') {
    const bankNiftyLtp = Number(bankQuote?.last_price || 0);
    const bankNiftyOpen = Number(bankQuote?.ohlc?.open || bankNiftyLtp);
    const bankNiftyChg = Number(bankQuote?.net_change ?? bankNiftyLtp - bankNiftyOpen);
    const isBankNiftyDown = bankNiftyLtp > 0 && (bankNiftyChg < 0 || bankNiftyLtp < bankNiftyOpen);
    const isBankNiftyUp = bankNiftyLtp > 0 && bankNiftyChg > 0 && bankNiftyLtp > bankNiftyOpen;
    if (signal.signalType === 'BUY' && (isBankNiftyDown || corporateHeavyweightScore <= -10)) {
      signal.signalType = 'HOLD';
      signal.confidenceScore = 40;
      signal.reason =
        'Cross-Index Veto: BankNifty / Banking heavyweights are Bearish; BANKEX CE strictly blocked.';
    } else if (signal.signalType === 'SELL' && (isBankNiftyUp || corporateHeavyweightScore >= 10)) {
      signal.signalType = 'HOLD';
      signal.confidenceScore = 40;
      signal.reason =
        'Cross-Index Veto: BankNifty / Banking heavyweights are Bullish; BANKEX PE strictly blocked.';
    }
  }
}
