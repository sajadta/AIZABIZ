import React from 'react';
import {
  BarChart2,
  Cpu,
  Layers,
  Briefcase,
  Sparkles,
  PieChart,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { BotConfig, Holding, Language, Position, StockQuote } from '../../types';
import type { OrderModalData, TabKey, Translations } from './types';

interface AppDesktopNavProps {
  t: Translations;
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  botConfig: BotConfig;
  currentQuote: StockQuote;
  holdings: Holding[];
  positions: Position[];
  selectedSymbol: string;
  language: Language;
  setIsOrderModalOpen: (v: boolean) => void;
  setOrderModalData: (v: OrderModalData) => void;
}

export const AppDesktopNav: React.FC<AppDesktopNavProps> = ({
  t,
  activeTab,
  setActiveTab,
  botConfig,
  currentQuote,
  holdings,
  positions,
  selectedSymbol,
  language,
  setIsOrderModalOpen,
  setOrderModalData,
}) => (
  <>
    {/* Desktop Navigation Bar */}
    <div className="hidden lg:flex items-center justify-between border-b border-slate-800 pb-2 mb-2 shrink-0 overflow-x-auto no-scrollbar gap-2">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setActiveTab('WATCHLIST')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === 'WATCHLIST'
              ? 'bg-indigo-600 text-white shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t.watchlist}</span>
        </button>

        <button
          onClick={() => setActiveTab('CHART')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === 'CHART'
              ? 'bg-indigo-600 text-white shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>{t.chart}</span>
        </button>

        <button
          onClick={() => setActiveTab('BOT')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === 'BOT'
              ? 'bg-indigo-600 text-white shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>{t.algoBot}</span>
          {botConfig.enabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('OPTIONS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === 'OPTIONS'
              ? 'bg-indigo-600 text-white shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t.optionChain}</span>
        </button>

        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm relative ${
            activeTab === 'ORDERS'
              ? 'bg-indigo-600 text-white shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>{t.ordersPositions}</span>
          {positions.length > 0 && (
            <span className="px-1.5 py-0.2 bg-emerald-500 text-slate-950 font-black text-[9px] rounded-full">
              {positions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('HOLDINGS')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm relative ${
            activeTab === 'HOLDINGS'
              ? 'bg-indigo-600 text-white shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>{language === 'ml' ? 'ഹോൾഡിങ്സ്' : 'Holdings'}</span>
          {holdings.length > 0 && (
            <span className="px-1.5 py-0.2 bg-indigo-500/30 text-indigo-300 font-bold text-[9px] rounded-full border border-indigo-500/40">
              {holdings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('HEATMAP')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === 'HEATMAP'
              ? 'bg-indigo-600 text-white shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>{language === 'ml' ? 'ഹീറ്റ്മാപ്പ്' : 'Heatmap'}</span>
        </button>

        <button
          onClick={() => setActiveTab('AI')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === 'AI'
              ? 'bg-indigo-600 text-white shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{t.aiAdvisor}</span>
        </button>

        <button
          onClick={() => setActiveTab('INVEST')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
            activeTab === 'INVEST'
              ? 'bg-indigo-600 text-white shadow-indigo-600/30'
              : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <PieChart className="w-3.5 h-3.5 text-emerald-400" />
          <span>{language === 'ml' ? 'നിക്ഷേപം (Invest)' : 'Invest (MF & IPO)'}</span>
        </button>
      </div>

      {/* Quick Action Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setOrderModalData({
              symbol: selectedSymbol,
              price: currentQuote.ltp,
              type: 'BUY',
            });
            setIsOrderModalOpen(true);
          }}
          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-sm shadow-emerald-500/20 flex items-center gap-1"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{t.quickBuy}</span>
        </button>
        <button
          onClick={() => {
            setOrderModalData({
              symbol: selectedSymbol,
              price: currentQuote.ltp,
              type: 'SELL',
            });
            setIsOrderModalOpen(true);
          }}
          className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs transition shadow-sm shadow-rose-500/20 flex items-center gap-1"
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>{t.quickSell}</span>
        </button>
      </div>
    </div>
  </>
);
