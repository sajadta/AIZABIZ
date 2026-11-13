import React from 'react';
import { Briefcase } from 'lucide-react';
import { PositionItem } from './PositionItem';
import type { Order, Position, Holding, Language } from '../../types';
import type { AccountSummary, ViewChartFn } from './types';

interface PositionsTabProps {
  positions: Position[];
  language: Language;
  onSquareOffPosition: (positionId: string) => void;
  onViewChart?: ViewChartFn;
  positionFilter: 'ALL' | 'OPTIONS' | 'INDEX_EQUITY';
  setPositionFilter: (v: 'ALL' | 'OPTIONS' | 'INDEX_EQUITY') => void;
  filteredPositions: Position[];
  newlyAddedIds: Set<string>;
  todayIst: string;
  accountSummary: AccountSummary;
}

export const PositionsTab: React.FC<PositionsTabProps> = ({
  positions,
  language,
  onSquareOffPosition,
  onViewChart,
  positionFilter,
  setPositionFilter,
  filteredPositions,
  newlyAddedIds,
  todayIst,
  accountSummary,
}) => (
  <>
    <div className="space-y-3">
      {/* DUAL SUMMARY: 1. Today's Trading Performance & 2. Total All-Time Cumulative Performance */}
      <div className="space-y-2.5">
        {/* Row 1: Today's Trading Performance */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/25 via-slate-900/90 to-slate-900 border border-emerald-900/50 shadow-md">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-900/30">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] font-black uppercase tracking-wide text-emerald-300">
                {language === 'ml'
                  ? '📅 ഇന്നത്തെ ട്രേഡിംഗ് സംഗ്രഹം (Today: ' + todayIst + ')'
                  : "📅 Today's Trading Summary (" + todayIst + ')'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-900/50 text-emerald-200 font-bold">
                {accountSummary.today.todayTradesCount} {language === 'ml' ? 'ട്രേഡുകൾ' : 'Trades'}
              </span>
            </div>
            <div className="text-[11px] font-mono font-bold text-slate-300">
              <span className="text-slate-400 text-[10px] mr-1">
                {language === 'ml' ? 'വിജയം:' : 'Win Rate:'}
              </span>
              <span className="text-emerald-400 font-black">
                {accountSummary.today.todayWinRate}%
              </span>
              <span className="text-slate-500 text-[10px] ml-1">
                ({accountSummary.today.todayWins}W / {accountSummary.today.todayLosses}L)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                {language === 'ml' ? 'ഇന്നത്തെ ലാഭം (Gross)' : 'Today Gross Win'}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-0.5 block">
                +₹{accountSummary.today.todayGrossProfit.toFixed(2)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-rose-400 block">
                {language === 'ml' ? 'ഇന്നത്തെ നഷ്ടം (Gross)' : 'Today Gross Loss'}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-rose-400 mt-0.5 block">
                -₹{accountSummary.today.todayGrossLoss.toFixed(2)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-300 block">
                {language === 'ml' ? 'ഇന്നത്തെ ബ്രോക്കറേജ് & ടാക്സ്' : 'Today Brokerage & Taxes'}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-amber-300 mt-0.5 block">
                ₹{accountSummary.today.todayBrokerage.toFixed(2)}
              </span>
            </div>
            <div
              className={`p-2.5 rounded-xl border ${
                accountSummary.today.todayNetPnL >= 0
                  ? 'bg-emerald-950/40 border-emerald-500/50'
                  : 'bg-rose-950/40 border-rose-500/50'
              }`}
            >
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-cyan-300 block">
                {language === 'ml' ? 'ഇന്നത്തെ അറ്റ ലാഭം (Net P&L)' : 'Today Net P&L'}
              </span>
              <span
                className={`text-sm sm:text-base font-black font-mono mt-0.5 block ${
                  accountSummary.today.todayNetPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {accountSummary.today.todayNetPnL >= 0 ? '+' : '-'}₹
                {Math.abs(accountSummary.today.todayNetPnL).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Total All-Time Cumulative Performance */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-950/25 via-slate-900/90 to-slate-900 border border-indigo-900/50 shadow-md">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-900/30">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span className="text-[11px] font-black uppercase tracking-wide text-cyan-300">
                {language === 'ml'
                  ? '🌐 ആകെ മൊത്തം ട്രേഡിംഗ് ഹിസ്റ്ററി (All-Time)'
                  : '🌐 Total Cumulative Performance (All-Time)'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-900/50 text-indigo-200 font-bold">
                {accountSummary.totalTradesCount}{' '}
                {language === 'ml' ? 'ആകെ ട്രേഡുകൾ' : 'Total Trades'}
              </span>
            </div>
            <div className="text-[11px] font-mono font-bold text-slate-300">
              <span className="text-slate-400 text-[10px] mr-1">
                {language === 'ml' ? 'ആകെ വിൻ റേറ്റ്:' : 'Overall Win Rate:'}
              </span>
              <span className="text-cyan-300 font-black">{accountSummary.allTimeWinRate}%</span>
              <span className="text-slate-500 text-[10px] ml-1">
                ({accountSummary.totalWins}W / {accountSummary.totalLosses}L)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                {language === 'ml' ? 'ആകെ ലാഭം (Total Gross)' : 'Total Gross Profit'}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-0.5 block">
                +₹{accountSummary.totalGrossProfit.toFixed(2)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-rose-400 block">
                {language === 'ml' ? 'ആകെ നഷ്ടം (Total Gross)' : 'Total Gross Loss'}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-rose-400 mt-0.5 block">
                -₹{accountSummary.totalGrossLoss.toFixed(2)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-300 block">
                {language === 'ml' ? 'ആകെ ബ്രോക്കറേജ് & ടാക്സ്' : 'Total Brokerage & Taxes'}
              </span>
              <span className="text-sm sm:text-base font-black font-mono text-amber-300 mt-0.5 block">
                ₹{accountSummary.totalBrokerageCharges.toFixed(2)}
              </span>
            </div>
            <div
              className={`p-2.5 rounded-xl border ${
                accountSummary.netPnLAfterCharges >= 0
                  ? 'bg-indigo-950/40 border-indigo-500/50'
                  : 'bg-rose-950/40 border-rose-500/50'
              }`}
            >
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-cyan-300 block">
                {language === 'ml' ? 'ആകെ അറ്റ ലാഭം (Total Net P&L)' : 'Total Net P&L'}
              </span>
              <span
                className={`text-sm sm:text-base font-black font-mono mt-0.5 block ${
                  accountSummary.netPnLAfterCharges >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {accountSummary.netPnLAfterCharges >= 0 ? '+' : '-'}₹
                {Math.abs(accountSummary.netPnLAfterCharges).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Segment Category Switcher (Options vs Index/Equity) */}
      <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
          <button
            onClick={() => setPositionFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg transition ${
              positionFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'ml' ? 'എല്ലാം' : 'All'} ({positions.length})
          </button>
          <button
            onClick={() => setPositionFilter('OPTIONS')}
            className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
              positionFilter === 'OPTIONS'
                ? 'bg-fuchsia-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{language === 'ml' ? 'ഓപ്ഷൻ ട്രേഡിംഗ്' : 'Options'}</span>
            <span className="text-[10px] opacity-75">
              (
              {
                positions.filter(
                  (p) => p.isOption || p.symbol.includes('CE') || p.symbol.includes('PE'),
                ).length
              }
              )
            </span>
          </button>
          <button
            onClick={() => setPositionFilter('INDEX_EQUITY')}
            className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
              positionFilter === 'INDEX_EQUITY'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{language === 'ml' ? 'ഇൻഡക്സ് / ഇക്വിറ്റി' : 'Index / Equity'}</span>
            <span className="text-[10px] opacity-75">
              (
              {
                positions.filter(
                  (p) => !p.isOption && !p.symbol.includes('CE') && !p.symbol.includes('PE'),
                ).length
              }
              )
            </span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          {language === 'ml' ? 'തത്സമയ പ്രീമിയം & വിപണി വില' : 'Real-time Premium & Market Quotes'}
        </div>
      </div>

      {filteredPositions.length === 0 ? (
        <div className="p-8 text-center text-slate-500">
          <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-700" />
          <p className="text-xs font-semibold">
            {language === 'ml'
              ? 'നിലവിൽ തിരഞ്ഞെടുത്ത വിഭാഗത്തിൽ പൊസിഷനുകൾ ഒന്നുമില്ല.'
              : 'No active positions in this category.'}
          </p>
          <p className="text-[11px] text-slate-600 mt-1">
            {language === 'ml'
              ? 'അൽഗോരിതം ലൈവായി അടുത്ത അവസരങ്ങൾ നിരീക്ഷിക്കുന്നു.'
              : 'The algo engine is continuously scanning for high-probability setups.'}
          </p>
        </div>
      ) : (
        filteredPositions.map((pos) => (
          <PositionItem
            key={pos.id + '-' + pos.productType}
            pos={pos}
            onSquareOff={onSquareOffPosition}
            isNew={newlyAddedIds.has(pos.id)}
            onViewChart={onViewChart}
            language={language}
          />
        ))
      )}
    </div>
  </>
);
