import React from 'react';
import { Briefcase, CheckCheck } from 'lucide-react';
import type { Order, Position, Holding, Language } from '../../types';
import type { TabKey, Translations } from './types';
interface OrderBookHeaderProps {
  t: Translations;
  activeTab: TabKey;
  setActiveTab: (v: TabKey) => void;
  positions: Position[];
  orders: Order[];
  tradeHistory: Position[];
  holdings: Holding[];
  language: Language;
  onSquareOffAll: () => void;
  totalPnL: number;
}
export const OrderBookHeader: React.FC<OrderBookHeaderProps> = ({
  t,
  activeTab,
  setActiveTab,
  positions,
  orders,
  tradeHistory,
  holdings,
  language,
  onSquareOffAll,
  totalPnL,
}) => (
  <>
    {/* Header & Tabs */}
    <div className="pb-3 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap w-full max-w-full min-w-0">
      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="p-1 sm:p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <h3 className="text-xs sm:text-sm font-black text-white tracking-tight uppercase truncate">
            {t.ordersPositions}
          </h3>
        </div>
        {positions.length > 0 && (
          <div className="flex sm:hidden items-center gap-1.5">
            <div
              className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] font-black ${
                totalPnL >= 0
                  ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
                  : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
              }`}
            >
              <span>
                {totalPnL >= 0 ? `+₹${totalPnL.toFixed(1)}` : `-₹${Math.abs(totalPnL).toFixed(1)}`}
              </span>
            </div>
            <button
              onClick={onSquareOffAll}
              className="px-2 py-0.5 rounded-lg bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[10px] font-black"
            >
              Exit All
            </button>
          </div>
        )}
      </div>
      {/* Sub Tabs Pill Row with horizontal scroll on small devices */}
      <div className="w-full sm:w-auto overflow-x-auto no-scrollbar py-0.5">
        <div className="flex bg-black/40 p-1 rounded-xl border border-slate-800 text-xs font-black shadow-inner min-w-max gap-1">
          <button
            onClick={() => setActiveTab('POSITIONS')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap text-xs flex items-center gap-1.5 ${
              activeTab === 'POSITIONS'
                ? 'bg-indigo-600 text-white shadow-sm font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{t.activePositions}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'POSITIONS' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              {positions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('HOLDINGS')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap text-xs flex items-center gap-1.5 ${
              activeTab === 'HOLDINGS'
                ? 'bg-indigo-600 text-white shadow-sm font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{language === 'ml' ? 'ഹോൾഡിങ്സ്' : 'Holdings'}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'HOLDINGS' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              {holdings.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('ORDERS')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap text-xs flex items-center gap-1.5 ${
              activeTab === 'ORDERS'
                ? 'bg-indigo-600 text-white shadow-sm font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>{language === 'ml' ? 'ഓർഡർ ബുക്ക്' : 'Order Book'}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'ORDERS' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              {orders.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('TRADE_HISTORY')}
            className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap text-xs flex items-center gap-1.5 ${
              activeTab === 'TRADE_HISTORY'
                ? 'bg-indigo-600 text-white shadow-sm font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
            <span>
              {language === 'ml'
                ? 'പൂർത്തിയായ ട്രേഡുകൾ (വാങ്ങലും വിൽക്കലും)'
                : 'Trade History (Paired)'}
            </span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'TRADE_HISTORY' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              {tradeHistory.length}
            </span>
          </button>
        </div>
      </div>
    </div>
  </>
);
