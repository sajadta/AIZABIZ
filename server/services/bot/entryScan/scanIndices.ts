// Resolves which index (or all indices) the entry scanner should evaluate for the
// current selected-index priority setting.

export interface ScanIndex {
  key: string;
  symbol: string;
}

export const ALL_SCAN_INDICES: ScanIndex[] = [
  { key: 'NSE_INDEX|Nifty 50', symbol: 'NIFTY 50' },
  { key: 'NSE_INDEX|Nifty Bank', symbol: 'NIFTY BANK' },
  { key: 'BSE_INDEX|SENSEX', symbol: 'SENSEX' },
  { key: 'NSE_INDEX|Nifty Fin Service', symbol: 'NIFTY FIN SERVICE' },
  { key: 'NSE_INDEX|NIFTY MID SELECT', symbol: 'MIDCPNIFTY' },
  { key: 'BSE_INDEX|BANKEX', symbol: 'BANKEX' },
];

const SINGLE_INDEX_PRIORITIES: Record<string, string> = {
  NIFTY_50_ONLY: 'NSE_INDEX|Nifty 50',
  BANKNIFTY_ONLY: 'NSE_INDEX|Nifty Bank',
  SENSEX_ONLY: 'BSE_INDEX|SENSEX',
  FINNIFTY_ONLY: 'NSE_INDEX|Nifty Fin Service',
  MIDCPNIFTY_ONLY: 'NSE_INDEX|NIFTY MID SELECT',
  BANKEX_ONLY: 'BSE_INDEX|BANKEX',
};

const MULTI_INDEX_PRIORITIES = new Set([
  'FULL_AUTO_MULTI_INDEX',
  'ALL_NIFTY_PRIORITY',
  'ALL_EQUAL',
]);

export const resolveScanIndices = (config: {
  selectedIndexPriority?: string;
  selectedInstrumentKey?: string;
}): ScanIndex[] => {
  const priority = config.selectedIndexPriority || 'FULL_AUTO_MULTI_INDEX';

  const singleKey = SINGLE_INDEX_PRIORITIES[priority];
  if (singleKey) return ALL_SCAN_INDICES.filter((x) => x.key === singleKey);

  if (config.selectedInstrumentKey && !MULTI_INDEX_PRIORITIES.has(priority)) {
    const matching = ALL_SCAN_INDICES.find((x) => x.key === config.selectedInstrumentKey);
    if (matching) return [matching];
  }

  return ALL_SCAN_INDICES;
};
