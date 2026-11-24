// Multi-index alpha matrix: index-priority ribbon, intelligence drawer and the
// six-index radar cards with per-index trade verdicts.
import React from 'react';
import { Layers } from 'lucide-react';
import { AlphaIndexCard } from './AlphaIndexCard';
import { IndexIntelligenceDrawer } from './IndexIntelligenceDrawer';
import type {
  BotConfig,
  Language,
  MultiIndexAlphaItem,
  StockQuote,
  TradingSignal,
} from '../../../types';

interface AlphaMatrixProps {
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  signals: TradingSignal[];
  language: Language;
  multiIndexData: MultiIndexAlphaItem[];
  showIndexIntelligence: boolean;
  setShowIndexIntelligence: (v: boolean) => void;
  quotes: StockQuote[];
  onSelectOptionTrade?: (
    type: 'BUY' | 'SELL',
    optionSymbol: string,
    price: number,
    instrumentKey?: string,
    lotSize?: number,
  ) => void;
  onSelectSymbol?: (symbol: string, instrumentKey?: string) => void;
  selectedSymbol?: string;
  onExecuteSignal: (signal: TradingSignal) => void;
}

export const AlphaMatrix: React.FC<AlphaMatrixProps> = ({
  botConfig,
  onUpdateBotConfig,
  signals,
  language,
  multiIndexData,
  showIndexIntelligence,
  setShowIndexIntelligence,
  quotes,
  onSelectOptionTrade,
  onSelectSymbol,
  selectedSymbol,
  onExecuteSignal,
}) => (
  <>
    {/* Multi-Index Real-Time Alpha Opportunity Matrix (Integrated Design) */}
    <div className="p-4 rounded-2xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/30 shadow-inner text-xs space-y-3 transition-all duration-500 hover:border-emerald-500/10">
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800/20">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400/70" />
          <div>
            <span className="font-bold text-slate-100 text-xs block">
              {language === 'ml'
                ? '📊 സൂചികകൾ & ഓപ്ഷൻ പ്രീമിയം സെലക്ടർ'
                : '📊 Indices & Option Premium Selector'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIndexIntelligence(!showIndexIntelligence)}
            className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-slate-800/40 hover:bg-slate-800 text-cyan-400/80 border border-slate-800 transition"
          >
            {language === 'ml' ? 'വിശദാംശങ്ങൾ' : 'Details'}
          </button>
          <span className="text-[9px] font-mono font-bold text-emerald-400/80 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE</span>
          </span>
        </div>
      </div>
      {/* Index Priority Mode Selector Buttons (Clean Flat Ribbon) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>{language === 'ml' ? 'ഇൻഡക്സ് ഫോക്കസ് മോഡ്:' : 'Index Focus Mode:'}</span>
          <span className="text-cyan-400 font-bold">
            {botConfig.selectedIndexPriority || 'FULL_AUTO_MULTI_INDEX'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            {
              id: 'FULL_AUTO_MULTI_INDEX',
              labelMl: '⚡ ഓട്ടോ സ്കാനർ (എല്ലാം)',
              labelEn: '⚡ Full Auto (All 6)',
            },
            { id: 'NIFTY_50_ONLY', labelMl: 'NIFTY 50', labelEn: 'NIFTY 50' },
            { id: 'BANKNIFTY_ONLY', labelMl: 'BANKNIFTY', labelEn: 'BANKNIFTY' },
            { id: 'SENSEX_ONLY', labelMl: 'SENSEX', labelEn: 'SENSEX' },
            { id: 'FINNIFTY_ONLY', labelMl: 'FINNIFTY', labelEn: 'FINNIFTY' },
            { id: 'MIDCPNIFTY_ONLY', labelMl: 'MIDCPNIFTY', labelEn: 'MIDCPNIFTY' },
            { id: 'BANKEX_ONLY', labelMl: 'BANKEX', labelEn: 'BANKEX' },
          ].map((mode) => {
            const isSelected =
              (botConfig.selectedIndexPriority || 'FULL_AUTO_MULTI_INDEX') === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => {
                  onUpdateBotConfig({
                    selectedIndexPriority: mode.id as any,
                  });
                  // Sync main chart if it's a specific index
                  const symMap: Record<string, string> = {
                    NIFTY_50_ONLY: 'NIFTY 50',
                    BANKNIFTY_ONLY: 'BANKNIFTY',
                    SENSEX_ONLY: 'SENSEX',
                    FINNIFTY_ONLY: 'FINNIFTY',
                    MIDCPNIFTY_ONLY: 'MIDCPNIFTY',
                    BANKEX_ONLY: 'BANKEX',
                  };
                  if (symMap[mode.id]) {
                    if (onSelectSymbol) onSelectSymbol(symMap[mode.id]);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 shadow font-black'
                    : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/60'
                }`}
              >
                {language === 'ml' ? mode.labelMl : mode.labelEn}
              </button>
            );
          })}
        </div>
      </div>
      {showIndexIntelligence && <IndexIntelligenceDrawer language={language} />}
      {/* 6-Index Real-Time Alpha Radar Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-2.5 text-[10px] font-mono">
        {[
          { name: 'NIFTY 50', key: 'NSE_INDEX|Nifty 50', exch: 'NSE', lot: 65, exp: 'Thu' },
          { name: 'BANKNIFTY', key: 'NSE_INDEX|Nifty Bank', exch: 'NSE', lot: 30, exp: 'Wed' },
          { name: 'SENSEX', key: 'BSE_INDEX|SENSEX', exch: 'BSE', lot: 20, exp: 'Fri' },
          {
            name: 'FINNIFTY',
            key: 'NSE_INDEX|Nifty Fin Service',
            exch: 'NSE',
            lot: 60,
            exp: 'Tue',
          },
          {
            name: 'MIDCPNIFTY',
            key: 'NSE_INDEX|NIFTY MID SELECT',
            exch: 'NSE',
            lot: 120,
            exp: 'Mon',
          },
          { name: 'BANKEX', key: 'BSE_INDEX|BANKEX', exch: 'BSE', lot: 30, exp: 'Mon' },
        ].map((item, idx) => {
          const matrixItem = multiIndexData.find(
            (m) => m.key === item.key || m.symbol.toUpperCase().includes(item.name.split(' ')[0]),
          );
          const matchingSig = signals.find(
            (s) =>
              s.underlyingInstrumentKey === item.key ||
              s.symbol.toUpperCase().includes(item.name.split(' ')[0]),
          );
          const matchingQuote = quotes.find(
            (q) =>
              q.symbol.toUpperCase().includes(item.name.split(' ')[0]) ||
              q.instrumentKey === item.key,
          );
          return (
            <AlphaIndexCard
              key={item.name}
              item={item}
              idx={idx}
              matrixItem={matrixItem}
              matchingSig={matchingSig}
              matchingQuote={matchingQuote}
              botConfig={botConfig}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={onSelectSymbol}
              onSelectOptionTrade={onSelectOptionTrade}
              onExecuteSignal={onExecuteSignal}
            />
          );
        })}
      </div>
    </div>
  </>
);
