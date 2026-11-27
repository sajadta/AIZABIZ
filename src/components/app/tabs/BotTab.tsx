import React from 'react';
import { AlgoBotPanel } from '../../AlgoBotPanel';
import type {
  BotConfig,
  BotLog,
  ExecutionMode,
  Language,
  OptionChainData,
  Position,
  StockQuote,
  TradingSignal,
} from '../../../types';
import type { OrderModalData } from '../types';

interface BotTabProps {
  quotes: StockQuote[];
  selectedSymbol: string;
  setSelectedSymbol: (v: string) => void;
  setSelectedInstrumentKey: (v: string) => void;
  language: Language;
  setOrderModalData: (v: OrderModalData) => void;
  setIsOrderModalOpen: (v: boolean) => void;
  activeSignal?: TradingSignal | null;
  optionChainData: OptionChainData | null;
  botConfig: BotConfig;
  setBotConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
  setMode: React.Dispatch<React.SetStateAction<ExecutionMode>>;
  botLogs: BotLog[];
  signals: TradingSignal[];
  handleExecuteSignal: (sig: TradingSignal) => Promise<void>;
  modeTradeHistory: Position[];
}

export const BotTab: React.FC<BotTabProps> = ({
  quotes,
  selectedSymbol,
  setSelectedSymbol,
  setSelectedInstrumentKey,
  language,
  setOrderModalData,
  setIsOrderModalOpen,
  activeSignal,
  optionChainData,
  botConfig,
  setBotConfig,
  setMode,
  botLogs,
  signals,
  handleExecuteSignal,
  modeTradeHistory,
}) => (
  <div className="h-full w-full max-w-full min-w-0 overflow-hidden">
    <AlgoBotPanel
      botConfig={botConfig}
      onUpdateBotConfig={(cfg) => {
        if (cfg.mode) {
          try {
            localStorage.setItem('aizabiz_preferred_trading_mode', cfg.mode);
          } catch {
            // Ignored
          }
          setMode(cfg.mode);
        }
        setBotConfig((prev) => {
          const updated = { ...prev, ...cfg };
          fetch('/api/bot/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated),
          }).catch(() => {
            /* ignore */
          });
          return updated;
        });
      }}
      botLogs={botLogs}
      signals={signals}
      language={language}
      selectedSymbol={selectedSymbol}
      onSelectSymbol={(sym, key) => {
        setSelectedSymbol(sym);
        if (key) setSelectedInstrumentKey(key);
        else {
          const matched = quotes.find((q) => q.symbol === sym);
          if (matched?.instrumentKey) setSelectedInstrumentKey(matched.instrumentKey);
        }
      }}
      onExecuteSignal={handleExecuteSignal}
      optionChainData={optionChainData}
      quotes={quotes}
      tradeHistory={modeTradeHistory}
      activeSignal={activeSignal}
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
    />
  </div>
);
