import React from 'react';
import {
  Briefcase,
  Clock,
  CheckCircle2,
  BarChart2,
  Calendar,
  Sparkles,
  CheckCheck,
} from 'lucide-react';
import { formatTradeDateTime } from './tradeUtils';
import { calculateTradeCharges } from '../../utils/indicators';
import type { Order, Position, Language } from '../../types';
import type { ViewChartFn } from './types';
import { PairedTradeCard } from './PairedTradeCard';
interface OrdersTabProps {
  positions: Position[];
  orders: Order[];
  tradeHistory: Position[];
  language: Language;
  onViewChart?: ViewChartFn;
  newlyAddedIds: Set<string>;
  ordersViewMode: 'PAIRED' | 'INDIVIDUAL';
  setOrdersViewMode: (v: 'PAIRED' | 'INDIVIDUAL') => void;
}
export const OrdersTab: React.FC<OrdersTabProps> = ({
  positions,
  orders,
  tradeHistory,
  language,
  onViewChart,
  newlyAddedIds,
  ordersViewMode,
  setOrdersViewMode,
}) => (
  <>
    <div className="space-y-3">
      {/* ORDERS VIEW MODE TOGGLE & EXPLANATION BANNER */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>
              {language === 'ml'
                ? 'ബ്രോക്കർ ഓർഡർ ബുക്ക് & റൗണ്ട്-ട്രിപ്പ്'
                : 'Broker Order Book & Round-Trips'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {language === 'ml'
              ? 'താഴെ വാങ്ങിയതും വിറ്റതുമായ ട്രേഡുകൾ ഒന്നിച്ചോ (Paired), അല്ലെങ്കിൽ ഓരോ ഓർഡറും പ്രത്യേകമായോ (Raw Orders) കാണാം.'
              : 'View paired round-trip trades or raw broker executions.'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-black/50 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setOrdersViewMode('PAIRED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              ordersViewMode === 'PAIRED'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{language === 'ml' ? 'വാങ്ങലും വിൽക്കലും ഒരുമിച്ച്' : 'Paired Round-Trips'}</span>
          </button>
          <button
            type="button"
            onClick={() => setOrdersViewMode('INDIVIDUAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              ordersViewMode === 'INDIVIDUAL'
                ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{language === 'ml' ? 'ഓരോ ഓർഡറും പ്രത്യേകം' : 'Individual Fills'}</span>
          </button>
        </div>
      </div>
      {/* If PAIRED mode is active, display the completed paired trades with date & buy+sell together */}
      {ordersViewMode === 'PAIRED' ? (
        tradeHistory.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
            <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-700" />
            <p className="text-xs font-semibold">
              {language === 'ml'
                ? 'പൂർത്തിയായ റൗണ്ട്-ട്രിപ്പ് ട്രേഡുകൾ ഒന്നുമില്ല.'
                : 'No completed round-trip trades recorded.'}
            </p>
          </div>
        ) : (
          tradeHistory.map((pos) => {
            return (
              <PairedTradeCard
                key={`paired_${pos.id}`}
                pos={pos}
                language={language}
                onViewChart={onViewChart}
              />
            );
          })
        )
      ) : /* INDIVIDUAL ORDERS VIEW */
      orders.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
          <Clock className="w-8 h-8 mx-auto mb-2 text-slate-700" />
          <p className="text-xs font-semibold">
            {language === 'ml'
              ? 'ഇതുവരെ ഓർഡറുകൾ ഒന്നും നൽകിയിട്ടില്ല (മാർക്കറ്റ് സമയം 09:18 AM മുതൽ അൽഗോരിതം ട്രേഡ് എടുക്കും).'
              : 'No orders recorded in this session (Algo takes entries after 09:18 AM IST).'}
          </p>
        </div>
      ) : (
        orders.map((ord) => {
          const isNew = newlyAddedIds.has(ord.id);
          const isBuy = ord.transactionType === 'BUY';
          const execPx = Number(ord.executedPrice || ord.price || 0);
          const qty = Math.max(1, Number(ord.quantity || 1));
          const isOpt =
            /\b(CE|PE)\b/i.test(ord.symbol || '') || String(ord.instrumentKey || '').includes('FO');
          const matchingClosedTrade = tradeHistory.find((t) => {
            if ((ord as any).positionId && t.id === (ord as any).positionId) return true;
            if (t.symbol !== ord.symbol) return false;
            if (isBuy && Math.abs(Number(t.buyPrice || 0) - execPx) < 0.05) return true;
            if (!isBuy && Math.abs(Number(t.sellPrice || 0) - execPx) < 0.05) return true;
            return false;
          });
          const matchingOpenPos = matchingClosedTrade
            ? undefined
            : positions.find((p) => {
                if ((ord as any).positionId && p.id === (ord as any).positionId) return true;
                if (p.symbol !== ord.symbol) return false;
                return isBuy && Math.abs(Number(p.buyPrice || 0) - execPx) < 0.05;
              }) ||
              (!matchingClosedTrade && isBuy
                ? positions.find((p) => p.symbol === ord.symbol)
                : undefined);
          const entryPx = Number(
            (ord as any).buyPrice ||
              matchingOpenPos?.buyPrice ||
              matchingClosedTrade?.buyPrice ||
              execPx,
          );
          const currentOrExitPx = matchingOpenPos
            ? Number(matchingOpenPos.currentLTP || execPx)
            : Number(
                (ord as any).sellPrice ||
                  matchingClosedTrade?.sellPrice ||
                  matchingClosedTrade?.currentLTP ||
                  execPx,
              );
          const ordCharges = calculateTradeCharges(
            entryPx,
            qty,
            isOpt,
            currentOrExitPx,
            ord.instrumentKey || ord.symbol,
          );
          const legCharge = isBuy ? ordCharges.buyCharges : ordCharges.sellCharges;
          const roundTripTax = Number(
            (ord as any).brokerageCharges ||
              (matchingClosedTrade as any)?.brokerageCharges ||
              ordCharges.roundTripCharges,
          );
          const grossPnl = matchingOpenPos
            ? Number(matchingOpenPos.pnl ?? (currentOrExitPx - entryPx) * qty)
            : (ord as any).realizedPnL !== undefined
              ? Number((ord as any).realizedPnL)
              : matchingClosedTrade?.realizedPnL !== undefined
                ? Number(matchingClosedTrade.realizedPnL)
                : Number(((currentOrExitPx - entryPx) * qty).toFixed(2));
          const netPnlAfterTax =
            !matchingOpenPos && (ord as any).netRealizedPnL !== undefined
              ? Number((ord as any).netRealizedPnL)
              : Number((grossPnl - roundTripTax).toFixed(2));
          const orderFormattedDate = formatTradeDateTime(
            (ord as any).time || ord.timestamp,
            language,
          );
          return (
            <div
              key={ord.id}
              className={`p-4 rounded-2xl border transition-all duration-500 backdrop-blur-md shadow-[0_4px_20px_rgb(0,0,0,0.3)] relative overflow-hidden ${
                isNew
                  ? isBuy
                    ? 'animate-trade-glow-buy'
                    : 'animate-trade-glow-sell'
                  : 'bg-gradient-to-br from-[#0c1222]/80 to-[#080c16]/95 border-slate-800/80 hover:bg-[#0c1222]/90 hover:border-slate-700/60 animate-row-enter'
              }`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-tr ${isBuy ? 'from-emerald-500/5' : 'from-rose-500/5'} to-transparent pointer-events-none opacity-40`}
              />
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`px-2 py-1 rounded-lg text-[10px] font-black w-14 text-center shrink-0 tracking-wider ${
                      isBuy
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {isBuy
                      ? language === 'ml'
                        ? 'വാങ്ങൽ'
                        : 'BUY'
                      : language === 'ml'
                        ? 'വിൽക്കൽ'
                        : 'SELL'}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-white font-sans text-sm tracking-tight truncate">
                        {ord.symbol}
                      </span>
                      {isNew && (
                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                          <span className="w-1 h-1 rounded-full bg-cyan-400"></span>
                          {language === 'ml' ? 'പുതിയ ട്രേഡ്' : 'EXECUTED'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px]">
                      <span className="text-cyan-300 font-sans text-[10px] font-semibold flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        {orderFormattedDate.fullStr || ord.timestamp}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-700" />
                      <span className="text-slate-300 text-[10px] font-mono">
                        Qty: <strong className="text-white">{qty}</strong>
                      </span>
                      {ord.productType && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-700" />
                          <span className="text-slate-400 text-[10px] font-sans">
                            {ord.productType}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1 shrink-0">
                  <div className="text-white font-black text-sm sm:text-base font-mono">
                    ₹{execPx.toFixed(2)}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    {onViewChart && (
                      <button
                        type="button"
                        onClick={() =>
                          onViewChart(ord.symbol, ord.instrumentKey, {
                            symbol: ord.symbol,
                            buyPrice: entryPx,
                            currentLTP: currentOrExitPx,
                            pnl: grossPnl,
                            isOption: isOpt,
                          })
                        }
                        className="px-2 py-0.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-cyan-300 hover:text-white text-[10px] font-bold border border-indigo-500/30 transition flex items-center gap-1 active:scale-95"
                        title={
                          language === 'ml'
                            ? 'ഈ ഓർഡറിന്റെ ലൈവ് ചാർട്ട് കാണുക'
                            : 'View Live Candlestick Chart'
                        }
                      >
                        <BarChart2 className="w-3 h-3 text-cyan-300" />
                        <span>{language === 'ml' ? 'ചാർട്ട്' : 'Chart'}</span>
                      </button>
                    )}
                    <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{ord.status}</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Seamless execution breakdown row with light line separation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/50 text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span>
                    {language === 'ml' ? 'മൂല്യം:' : 'Val:'}{' '}
                    <strong className="text-slate-200">
                      ₹{(execPx * qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </strong>
                  </span>
                  <span>
                    {language === 'ml' ? 'ചാർജ്ജുകൾ:' : 'Chg:'}{' '}
                    <strong className="text-amber-300">
                      ₹{(!isBuy && matchingClosedTrade ? roundTripTax : legCharge).toFixed(2)}
                    </strong>
                  </span>
                </div>
                <div>
                  {matchingOpenPos ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {language === 'ml' ? 'ഹോൾഡ് ചെയ്യുന്നു' : 'Holding Active'}
                    </span>
                  ) : matchingClosedTrade && !isBuy ? (
                    <span className="text-[11px]">
                      Net:{' '}
                      <strong
                        className={`font-black ${netPnlAfterTax >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {netPnlAfterTax >= 0 ? '+' : ''}₹{netPnlAfterTax.toFixed(2)}
                      </strong>
                    </span>
                  ) : (
                    <span className="text-slate-400 font-sans text-[11px]">
                      {language === 'ml' ? 'പൂർത്തിയായി' : 'Filled'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  </>
);
