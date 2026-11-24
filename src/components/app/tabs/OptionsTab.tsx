import React from 'react';
import { OptionChainView } from '../../OptionChainView';
import type { Language, OptionChainData, StockQuote } from '../../../types';
import type { OrderModalData } from '../types';

interface OptionsTabProps {
  quotes: StockQuote[];
  selectedSymbol: string;
  setSelectedSymbol: (v: string) => void;
  setSelectedInstrumentKey: (v: string) => void;
  language: Language;
  setOrderModalData: (v: OrderModalData) => void;
  setIsOrderModalOpen: (v: boolean) => void;
  optionChainData: OptionChainData | null;
  handleViewChart: (sym: string, key?: string, context?: any) => void;
  optionChainLoading: boolean;
  fetchOptionChain: (expiryOverride?: string, symbolOverride?: string) => Promise<void>;
}

export const OptionsTab: React.FC<OptionsTabProps> = ({
  quotes,
  selectedSymbol,
  setSelectedSymbol,
  setSelectedInstrumentKey,
  language,
  setOrderModalData,
  setIsOrderModalOpen,
  optionChainData,
  handleViewChart,
  optionChainLoading,
  fetchOptionChain,
}) => (
  <div className="h-full w-full max-w-full min-w-0 overflow-hidden">
    <OptionChainView
      data={optionChainData}
      quotes={quotes}
      loading={optionChainLoading}
      onRefresh={fetchOptionChain}
      language={language}
      selectedSymbol={selectedSymbol}
      onSelectSymbol={(sym, key) => {
        setSelectedSymbol(sym);
        if (key) setSelectedInstrumentKey(key);
        fetchOptionChain(undefined, sym);
      }}
      onSelectOptionTrade={(type, optSym, prc, instrKey, liveLotSize) => {
        setOrderModalData({
          symbol: optSym,
          price: prc,
          type,
          instrumentKey: instrKey,
          quantity: liveLotSize && liveLotSize > 0 ? liveLotSize : undefined,
          lotSize: liveLotSize,
        });
        setIsOrderModalOpen(true);
      }}
      onViewChart={(sym, key) => handleViewChart(sym, key)}
    />
  </div>
);
