import React from 'react';
import { Watchlist } from '../../Watchlist';
import type { Language, PriceAlert, StockQuote } from '../../../types';
import type { OrderModalData, TabKey } from '../types';

interface WatchlistTabProps {
  setActiveTab: (tab: TabKey) => void;
  quotes: StockQuote[];
  selectedSymbol: string;
  setSelectedSymbol: (v: string) => void;
  setSelectedInstrumentKey: (v: string) => void;
  language: Language;
  setOrderModalData: (v: OrderModalData) => void;
  setIsOrderModalOpen: (v: boolean) => void;
  priceAlerts: PriceAlert[];
  handleAddAlert: (
    symbol: string,
    instrumentKey: string,
    targetPrice: number,
    condition: 'GREATER_THAN' | 'LESS_THAN',
  ) => void;
  handleRemoveAlert: (id: string) => void;
}

export const WatchlistTab: React.FC<WatchlistTabProps> = ({
  setActiveTab,
  quotes,
  selectedSymbol,
  setSelectedSymbol,
  setSelectedInstrumentKey,
  language,
  setOrderModalData,
  setIsOrderModalOpen,
  priceAlerts,
  handleAddAlert,
  handleRemoveAlert,
}) => (
  <div className="h-full w-full max-w-full min-w-0 overflow-hidden p-1 sm:p-2 bg-slate-950/40 rounded-xl border border-slate-800/80">
    <Watchlist
      quotes={quotes}
      selectedSymbol={selectedSymbol}
      onSelectSymbol={(sym, key) => {
        setSelectedSymbol(sym);
        if (key) setSelectedInstrumentKey(key);
        setActiveTab('CHART');
      }}
      language={language}
      onOpenOrderModal={(type, sym, prc) => {
        setOrderModalData({ symbol: sym, price: prc, type });
        setIsOrderModalOpen(true);
      }}
      priceAlerts={priceAlerts}
      onAddAlert={handleAddAlert}
      onRemoveAlert={handleRemoveAlert}
    />
  </div>
);
