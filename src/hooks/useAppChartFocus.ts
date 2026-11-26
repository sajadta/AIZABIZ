import { useCallback } from 'react';
import type { ChartTradeContext, StockQuote } from '../types';
import type { TabKey } from '../components/app/types';

interface UseAppChartFocusParams {
  quotes: StockQuote[];
  setSelectedSymbol: (v: string) => void;
  setSelectedInstrumentKey: (v: string) => void;
  setChartTradeContext: (v: ChartTradeContext | null) => void;
  setActiveTab: (tab: TabKey) => void;
}

const INDEX_KEYS: Array<[string, string]> = [
  ['BANKEX', 'BSE_INDEX|BANKEX'],
  ['SENSEX', 'BSE_INDEX|SENSEX'],
  ['BANK', 'NSE_INDEX|Nifty Bank'],
  ['FIN', 'NSE_INDEX|Nifty Fin Service'],
  ['NIFTY', 'NSE_INDEX|Nifty 50'],
];

/** Focuses the chart tab on a symbol, resolving the instrument key for options and indices. */
export function useAppChartFocus({
  quotes,
  setSelectedSymbol,
  setSelectedInstrumentKey,
  setChartTradeContext,
  setActiveTab,
}: UseAppChartFocusParams) {
  return useCallback(
    (sym: string, key?: string, context?: ChartTradeContext) => {
      setSelectedSymbol(sym);
      setChartTradeContext(context || null);

      const upper = sym.toUpperCase();
      const isOption = /\b(CE|PE)\b/i.test(sym) || upper.endsWith('CE') || upper.endsWith('PE');
      if (key && (key.startsWith('NSE_FO|') || key.startsWith('BSE_FO|') || isOption)) {
        setSelectedInstrumentKey(key);
      } else if (isOption) {
        setSelectedInstrumentKey(key || `NSE_FO|${sym}`);
      } else {
        const matched = quotes.find((q) => q.symbol === sym);
        const indexMatch = INDEX_KEYS.find(([needle]) => upper.includes(needle));
        setSelectedInstrumentKey(matched?.instrumentKey || indexMatch?.[1] || key || sym);
      }
      setActiveTab('CHART');
    },
    [quotes, setSelectedSymbol, setSelectedInstrumentKey, setChartTradeContext, setActiveTab],
  );
}
