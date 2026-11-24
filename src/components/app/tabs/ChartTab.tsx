import React from 'react';
import { CandlestickChart } from '../../CandlestickChart';
import type {
  CandleData,
  Language,
  OptionChainData,
  StockQuote,
  TradingSignal,
} from '../../../types';
import { getStandardIndexLotSize } from '../../../utils/quotes';
import type { OrderModalData, TabKey } from '../types';

interface ChartTabProps {
  setActiveTab: (tab: TabKey) => void;
  selectedSymbol: string;
  language: Language;
  setOrderModalData: (v: OrderModalData) => void;
  setIsOrderModalOpen: (v: boolean) => void;
  currentQuote: StockQuote;
  chartTradeContext?: any;
  setChartTradeContext: (v: any) => void;
  candles: CandleData[];
  chartInterval: string;
  setChartInterval: (v: string) => void;
  activeSignal?: TradingSignal | null;
  optionChainData: OptionChainData | null;
  getStandardIndexLotSize: typeof getStandardIndexLotSize;
  handleFetchGeminiAnalysis: () => Promise<void>;
  aiLoading: boolean;
}

export const ChartTab: React.FC<ChartTabProps> = ({
  setActiveTab,
  selectedSymbol,
  language,
  setOrderModalData,
  setIsOrderModalOpen,
  currentQuote,
  chartTradeContext,
  setChartTradeContext,
  candles,
  chartInterval,
  setChartInterval,
  activeSignal,
  optionChainData,
  getStandardIndexLotSize,
  handleFetchGeminiAnalysis,
  aiLoading,
}) => (
  <div className="h-full w-full max-w-full min-w-0 overflow-hidden flex flex-col">
    {chartTradeContext && (
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-500/40 px-3 py-2 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2 shadow-md">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded border ${
              chartTradeContext.isOption !== false
                ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {chartTradeContext.isOption !== false
              ? '🎯 OPTION PREMIUM CHART'
              : '📈 INSTRUMENT CHART'}
          </span>
          <strong className="text-white font-mono text-sm">
            {chartTradeContext.symbol || selectedSymbol}
          </strong>
          {chartTradeContext.buyPrice && (
            <span className="text-slate-300 font-mono text-xs">
              {language === 'ml' ? 'വാങ്ങിയത്' : 'Entry'}:{' '}
              <strong className="text-slate-100">₹{chartTradeContext.buyPrice.toFixed(2)}</strong>
            </span>
          )}
          {chartTradeContext.target && (
            <span className="text-emerald-400 font-mono text-xs">
              {language === 'ml' ? 'ടാർഗെറ്റ്' : 'Target'}:{' '}
              <strong>₹{chartTradeContext.target.toFixed(2)}</strong>
            </span>
          )}
          {chartTradeContext.stopLoss && (
            <span className="text-rose-400 font-mono text-xs">
              {language === 'ml' ? 'സ്റ്റോപ്പ് ലോസ്' : 'SL'}:{' '}
              <strong>₹{chartTradeContext.stopLoss.toFixed(2)}</strong>
            </span>
          )}
          {chartTradeContext.currentLTP && (
            <span className="text-cyan-300 font-mono text-xs">
              LTP: <strong>₹{chartTradeContext.currentLTP.toFixed(2)}</strong>
            </span>
          )}
          {chartTradeContext.pnl !== undefined && (
            <span
              className={`font-mono text-xs font-bold ${chartTradeContext.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              P&L: {chartTradeContext.pnl >= 0 ? '+' : ''}₹
              {Number(chartTradeContext.pnl).toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setChartTradeContext(null);
              setActiveTab('ORDERS');
            }}
            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold transition flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <span>⬅️ {language === 'ml' ? 'തിരികെ ഓർഡറുകളിലേക്ക്' : 'Back to Orders'}</span>
          </button>
        </div>
      </div>
    )}
    <div className="flex-1 w-full max-w-full min-w-0 overflow-hidden">
      <CandlestickChart
        symbol={selectedSymbol}
        quote={currentQuote}
        candles={candles}
        interval={chartInterval}
        onChangeInterval={setChartInterval}
        language={language}
        onOpenOrderModal={(type, sym, prc) => {
          const isIndex =
            sym.includes('INDEX') ||
            sym.includes('NIFTY') ||
            sym.includes('SENSEX') ||
            sym.includes('BANKEX');
          if (isIndex && activeSignal?.recommendedOptionStrike?.optionSymbol) {
            const opt = activeSignal.recommendedOptionStrike;
            const stdLot = getStandardIndexLotSize(opt.optionSymbol || selectedSymbol);
            setOrderModalData({
              symbol: opt.optionSymbol || selectedSymbol,
              price: opt.ltp || activeSignal.price || 100,
              type: 'BUY',
              instrumentKey: opt.instrumentKey || activeSignal.instrumentKey,
              quantity: opt.lotSize || stdLot,
              lotSize: opt.lotSize || stdLot,
            });
          } else if (isIndex && optionChainData?.strikes?.length) {
            const sorted = [...optionChainData.strikes].sort(
              (a, b) => Math.abs(a.strikePrice - prc) - Math.abs(b.strikePrice - prc),
            );
            const atm = sorted[0];
            const isCall = type === 'BUY';
            const optSymbol = `${selectedSymbol.replace(' 50', '')} ${atm.strikePrice} ${isCall ? 'CE' : 'PE'}`;
            const optLtp = isCall ? atm.callLTP : atm.putLTP;
            const optKey = isCall ? atm.callInstrumentKey : atm.putInstrumentKey;
            const lotSz =
              atm.lotSize || optionChainData.lotSize || getStandardIndexLotSize(selectedSymbol);
            setOrderModalData({
              symbol: optSymbol,
              price: optLtp || 100,
              type: 'BUY',
              instrumentKey: optKey,
              quantity: lotSz,
              lotSize: lotSz,
            });
          } else {
            setOrderModalData({ symbol: sym, price: prc, type });
          }
          setIsOrderModalOpen(true);
        }}
        onGenerateAiAnalysis={handleFetchGeminiAnalysis}
        aiLoading={aiLoading}
        signal={activeSignal}
      />
    </div>
  </div>
);
