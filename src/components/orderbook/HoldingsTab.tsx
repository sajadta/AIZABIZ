import React from 'react';
import {
  CheckCircle2,
  PieChart,
  Plus,
  RefreshCw,
  BarChart2,
  Check,
  Lock,
  Edit2,
  X,
} from 'lucide-react';
import type { Holding, Language } from '../../types';
import type { ViewChartFn } from './types';
interface HoldingsTabProps {
  holdings: Holding[];
  language: Language;
  onViewChart?: ViewChartFn;
  editingHoldingSym: string | null;
  setEditingHoldingSym: (v: string | null) => void;
  customBuyPriceInput: string;
  setCustomBuyPriceInput: (v: string) => void;
  savingBuyPrice: boolean;
  buyPriceSaveMessage: string | null;
  handleSaveCustomBuyPrice: (symbol: string, isin?: string) => Promise<void>;
  totalHoldingsInvested: number;
  totalHoldingsValue: number;
  totalHoldingsPnL: number;
  totalHoldingsPnLPercent: number;
  onOpenOrderModal?: (
    type: 'BUY' | 'SELL',
    symbol: string,
    price: number,
    options?: {
      quantity?: number;
      heldQuantity?: number;
      productType?: 'INTRADAY' | 'DELIVERY';
      instrumentKey?: string;
    },
  ) => void;
  onRefreshHoldings?: () => void;
  isConnected?: boolean;
  onOpenApiModal?: () => void;
}
export const HoldingsTab: React.FC<HoldingsTabProps> = ({
  holdings,
  language,
  onViewChart,
  editingHoldingSym,
  setEditingHoldingSym,
  customBuyPriceInput,
  setCustomBuyPriceInput,
  savingBuyPrice,
  buyPriceSaveMessage,
  handleSaveCustomBuyPrice,
  totalHoldingsInvested,
  totalHoldingsValue,
  totalHoldingsPnL,
  totalHoldingsPnLPercent,
  onOpenOrderModal,
  onRefreshHoldings,
  isConnected,
  onOpenApiModal,
}) => (
  <>
    <div className="space-y-4">
      {/* Holdings Summary Portfolio Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {language === 'ml' ? 'ഹോൾഡിങ്സ് പോർട്ട്ഫോളിയോ മൂല്യം' : 'Total Holdings Value'}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-white">
              ₹
              {totalHoldingsValue.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className={`text-xs font-bold font-mono ${totalHoldingsPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {totalHoldingsPnL >= 0 ? '+' : ''}₹{totalHoldingsPnL.toFixed(2)} (
              {totalHoldingsPnLPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">
              {language === 'ml' ? 'നിക്ഷേപിച്ചത്' : 'Invested'}
            </span>
            <span className="text-sm font-bold font-mono text-slate-200">
              ₹{totalHoldingsInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">
              {language === 'ml' ? 'ആകെ ഓഹരികൾ' : 'Total Scrips'}
            </span>
            <span className="text-sm font-bold font-mono text-cyan-400">
              {holdings.length} Stocks
            </span>
          </div>
          {onRefreshHoldings && (
            <button
              onClick={onRefreshHoldings}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95 flex items-center gap-1.5 text-xs font-bold shadow-sm"
              title={
                language === 'ml'
                  ? 'Upstox പോർട്ട്ഫോളിയോ വീണ്ടും സിങ്ക് ചെയ്യുക'
                  : 'Re-sync Upstox Holdings'
              }
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">
                {language === 'ml' ? 'പോർട്ട്ഫോളിയോ സിങ്ക്' : 'Sync Holdings'}
              </span>
            </button>
          )}
        </div>
      </div>
      {/* Notification Banner when custom buy price is locked */}
      {buyPriceSaveMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/60 text-emerald-300 text-xs font-bold animate-pulse flex items-center gap-2 shadow-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{buyPriceSaveMessage}</span>
        </div>
      )}
      {/* Holdings List */}
      {holdings.length === 0 ? (
        <div className="p-8 text-center text-slate-400 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 space-y-4">
          <PieChart className="w-10 h-10 mx-auto text-indigo-400 opacity-60" />
          <div>
            <p className="text-sm font-bold text-slate-200">
              {!isConnected
                ? language === 'ml'
                  ? '🔴 Upstox ലൈവ് ടോക്കൺ കണക്റ്റ് ചെയ്തിട്ടില്ല!'
                  : '🔴 Upstox Live Token is Not Connected!'
                : language === 'ml'
                  ? 'ഹോൾഡിങ്സ് (Holdings) ലിസ്റ്റ് ഒഴിഞ്ഞിരിക്കുന്നു'
                  : 'Holdings List is Currently Empty'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {!isConnected
                ? language === 'ml'
                  ? 'നിങ്ങളുടെ Upstox അക്കൗണ്ടിലെ ഹോൾഡിങ്‌സ് കാണുന്നതിന് ഇന്നത്തെ Access Token ആക്റ്റീവ് ആക്കേണ്ടതുണ്ട്.'
                  : "Please activate today's Upstox Access Token to load your Demat Holdings."
                : language === 'ml'
                  ? 'നിങ്ങളുടെ Upstox അക്കൗണ്ടിൽ നിലവിൽ ഡെലിവറി (CNC) ഓഹരികൾ ഒന്നും കാണുന്നില്ല.'
                  : 'No Delivery (CNC) holdings returned from your Upstox Demat account.'}
            </p>
          </div>
          {!isConnected && onOpenApiModal && (
            <button
              type="button"
              onClick={onOpenApiModal}
              className="mx-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-950 transition flex items-center gap-2"
            >
              <span>
                🔑 {language === 'ml' ? 'Upstox ടോക്കൺ കണക്റ്റ് ചെയ്യുക' : 'Connect Upstox Token'}
              </span>
            </button>
          )}
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-left text-xs max-w-lg mx-auto space-y-2">
            <p className="text-amber-400 font-bold flex items-center gap-1.5">
              <span>💡</span>
              <span>
                {language === 'ml'
                  ? 'ശ്രദ്ധിക്കുക (Important Notes):'
                  : 'Why are my holdings not showing?'}
              </span>
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px]">
              <li>
                <strong>
                  {language === 'ml' ? 'Upstox ടോക്കൺ സ്റ്റാറ്റസ്:' : 'Upstox Token Status:'}
                </strong>{' '}
                {language === 'ml'
                  ? 'API Key & Secret മാത്രം സേവ് ചെയ്താൽ ഹോൾഡിങ്‌സ് വരില്ല; ഇന്നത്തെ Access Token ജനറേറ്റ് ചെയ്ത് "🟢 Upstox ലൈവ് കണക്റ്റഡ്" ആണെന്ന് ഉറപ്പാക്കുക.'
                  : "Saving API Key & Secret alone is not enough; generate today's Access Token so status turns Green."}
              </li>
              <li>
                <strong>
                  {language === 'ml'
                    ? 'ഇൻട്രാഡേ & ഓപ്ഷൻ ട്രേഡുകൾ:'
                    : 'Intraday & Option Positions:'}
                </strong>{' '}
                {language === 'ml'
                  ? 'ഓപ്ഷനുകളും ഇൻട്രാഡേ ട്രേഡുകളും "Active Positions" ടാബിലാണ് കാണിക്കുക.'
                  : 'Option contracts and intraday trades appear in the "Active Positions" tab.'}
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {holdings.map((h, idx) => {
            const avgPx = Number(h.buyPrice ?? h.avgPrice ?? 0);
            const curLtp = Number(h.currentLTP || 0);
            const qty = Number(h.quantity || 0);
            const invested = h.investedValue || Number((qty * avgPx).toFixed(2));
            const currentVal = h.currentValue || Number((qty * curLtp).toFixed(2));
            const pnl = Number((currentVal - invested).toFixed(2));
            const pnlPercent =
              avgPx > 0 ? Number((((curLtp - avgPx) / avgPx) * 100).toFixed(2)) : 0;
            const isGain = pnl >= 0;
            const target50 = h.fiftyPercentTarget || {
              targetPrice: Number((avgPx * 1.5).toFixed(2)),
              targetTotalValue: Number((avgPx * 1.5 * qty).toFixed(2)),
              targetProfitAmount: Number((avgPx * 0.5 * qty).toFixed(2)),
              priceNeeded: Number(Math.max(0, avgPx * 1.5 - curLtp).toFixed(2)),
              profitRemaining: Number(Math.max(0, avgPx * 0.5 * qty - pnl).toFixed(2)),
              progressPct:
                avgPx > 0
                  ? Number(
                      Math.max(0, Math.min(100, ((curLtp - avgPx) / (avgPx * 0.5)) * 100)).toFixed(
                        1,
                      ),
                    )
                  : 0,
              isReached: avgPx > 0 && curLtp >= avgPx * 1.5,
            };
            const forecast = h.algoForecast;
            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 shadow-sm ${
                  target50.isReached
                    ? 'bg-gradient-to-br from-amber-950/40 via-slate-900/95 to-emerald-950/40 border-amber-400/80 shadow-[0_0_24px_rgba(251,191,36,0.25)]'
                    : isGain && pnl > 0
                      ? 'bg-slate-900/95 border-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.14)]'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-extrabold text-white">{h.symbol}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        DELIVERY · CNC
                      </span>
                      {h.isBuyPriceLocked && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          {language === 'ml' ? 'വാങ്ങിയ വില ലോക്ക് ചെയ്തു' : 'Buy Price Locked'}
                        </span>
                      )}
                      {h.isUpstoxZeroPrice && !h.isBuyPriceLocked && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          ⚠️{' '}
                          {language === 'ml'
                            ? 'ബ്രോക്കർ വില ലഭ്യമല്ല (ക്ലോസിങ് വില)'
                            : 'Zero broker price (Using close)'}
                        </span>
                      )}
                      {qty <= 0 && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {language === 'ml'
                            ? `ഇന്ന് വിറ്റത് (Sold Today${(h as any).soldTodayQty ? `: ${(h as any).soldTodayQty}` : ''})`
                            : `Sold Today${(h as any).soldTodayQty ? ` (${(h as any).soldTodayQty})` : ''}`}
                        </span>
                      )}
                      {qty > 0 && target50.isReached ? (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-400/60 animate-pulse">
                          ⚡ +50% PROFIT TARGET HIT!
                        </span>
                      ) : qty > 0 && isGain && pnl > 0 ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          🟢 IN PROFIT (ലാഭത്തിൽ)
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {h.companyName || `${h.symbol} Ltd`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-white">
                      ₹{curLtp.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">LTP</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-center font-mono">
                  <div>
                    <span className="text-[9px] text-slate-400 block">
                      {language === 'ml' ? 'അളവ് (Qty)' : 'Qty'}
                    </span>
                    <span className="text-xs font-bold text-slate-200">{qty}</span>
                  </div>
                  <div className="relative group">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[9px] text-slate-400 block">
                        {language === 'ml' ? 'വാങ്ങിയ വില (Avg)' : 'Avg Buy Price'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (editingHoldingSym === h.symbol) {
                            setEditingHoldingSym(null);
                          } else {
                            setEditingHoldingSym(h.symbol);
                            setCustomBuyPriceInput(String(avgPx > 0 ? avgPx : ''));
                          }
                        }}
                        className="text-slate-400 hover:text-cyan-300 transition p-0.5"
                        title={
                          language === 'ml'
                            ? 'വാങ്ങിയ യഥാർത്ഥ വില എഡിറ്റ് ചെയ്ത് ലോക്ക് ചെയ്യുക'
                            : 'Edit & lock actual buy price'
                        }
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <span className="text-xs font-bold text-slate-200 flex items-center justify-center gap-1">
                      ₹{avgPx.toFixed(2)}
                      {h.isBuyPriceLocked && <Lock className="w-2.5 h-2.5 text-cyan-400" />}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block">
                      {language === 'ml' ? 'നിക്ഷേപം (Invested)' : 'Invested'}
                    </span>
                    <span className="text-xs font-bold text-slate-300">₹{invested.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block">
                      {language === 'ml' ? 'ലാഭം / നഷ്ടം' : 'Exact P&L'}
                    </span>
                    <span
                      className={`text-xs font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {isGain ? '+' : ''}₹{pnl.toFixed(2)}
                      <span className="block text-[9px]">
                        ({pnlPercent >= 0 ? '+' : ''}
                        {pnlPercent.toFixed(2)}%)
                      </span>
                    </span>
                  </div>
                </div>
                {/* Interactive Custom Buy Price Editor */}
                {editingHoldingSym === h.symbol && (
                  <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        {language === 'ml'
                          ? `${h.symbol} വാങ്ങിയ യഥാർത്ഥ വില നിശ്ചയിക്കുക:`
                          : `Set Exact Buy Price for ${h.symbol}:`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingHoldingSym(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      {language === 'ml'
                        ? 'ബ്രോക്കർ നൽകിയ വില ശരിയല്ലെങ്കിൽ (ഉദാ: Upstox 0 നൽകുകയോ മുൻദിന ക്ലോസിങ് വില കാണിക്കുകയോ ചെയ്താൽ), നിങ്ങളുടെ യഥാർത്ഥ വാങ്ങിയ വില ഇവിടെ നൽകി സ്ഥിരപ്പെടുത്താം (ലോക്ക്).'
                        : 'If broker returns 0 or closing price, enter your actual acquisition price here to lock it permanently across restarts.'}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.05"
                          min="0.05"
                          value={customBuyPriceInput}
                          onChange={(e) => setCustomBuyPriceInput(e.target.value)}
                          placeholder={avgPx > 0 ? String(avgPx) : '10.50'}
                          className="w-full pl-6 pr-3 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/50 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={
                          savingBuyPrice ||
                          !customBuyPriceInput ||
                          parseFloat(customBuyPriceInput) <= 0
                        }
                        onClick={() => handleSaveCustomBuyPrice(h.symbol, h.isin)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shadow-sm"
                      >
                        {savingBuyPrice ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        <span>{language === 'ml' ? 'സ്ഥിരപ്പെടുത്തുക' : 'Save & Lock'}</span>
                      </button>
                    </div>
                  </div>
                )}
                {/* +50% Profitable Value Milestone Calculation Box */}
                <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[11px] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-amber-300 flex items-center gap-1">
                      🎯{' '}
                      {language === 'ml'
                        ? 'വാങ്ങിയ വിലയുടെ +50% ലാഭ കണക്കുകൂട്ടൽ:'
                        : '+50% Buy-Price Profit Milestone:'}
                    </span>
                    <span className="font-mono text-[10px] font-black text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/40">
                      {target50.isReached
                        ? '⚡ +50% ലക്ഷ്യം കൈവരിച്ചു!'
                        : `${target50.progressPct}% Complete`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono pt-1 border-t border-amber-500/20">
                    <div>
                      <span className="text-slate-400 block">
                        {language === 'ml' ? '+50% ടാർഗറ്റ് വില:' : '+50% Target LTP:'}
                      </span>
                      <strong className="text-amber-300">₹{target50.targetPrice.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">
                        {language === 'ml' ? '+50% ആകുമ്പോൾ ലാഭം:' : 'Profit at +50%:'}
                      </span>
                      <strong className="text-emerald-300">
                        +₹{target50.targetProfitAmount.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">
                        {language === 'ml' ? 'ഇനി വേണ്ട വില കയറ്റം:' : 'LTP Rise Needed:'}
                      </span>
                      <strong className="text-cyan-300">
                        {target50.isReached
                          ? '₹0.00 (Hit!)'
                          : `+₹${target50.priceNeeded.toFixed(2)}/sh`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">
                        {language === 'ml' ? '+50% മൂല്യം (Total):' : 'Value at +50%:'}
                      </span>
                      <strong className="text-white">
                        ₹{target50.targetTotalValue.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${target50.progressPct}%` }}
                    />
                  </div>
                </div>
                {/* Pre-Cognitive 8-Layer & 5-Year Historical Algorithmic Forecast for Holding */}
                {forecast && (
                  <div
                    className={`p-2.5 rounded-lg border text-[11px] flex flex-col gap-1.5 ${
                      forecast.direction === 'STRONG_UPTREND' || forecast.direction === 'UPTREND'
                        ? 'bg-emerald-950/25 border-emerald-500/35 text-emerald-200'
                        : forecast.direction === 'DOWNTREND_RISK'
                          ? 'bg-rose-950/25 border-rose-500/35 text-rose-200'
                          : 'bg-cyan-950/25 border-cyan-500/35 text-cyan-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-extrabold flex items-center gap-1.5 text-xs">
                        🧠{' '}
                        {language === 'ml'
                          ? 'അൽഗോരിതം മുൻകൂട്ടി കാണുന്ന പ്രവചനം (Algo Forecast):'
                          : 'Pre-Cognitive Algo Forecast:'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-[10px] font-bold">
                        Confidence: {forecast.confidencePct}% | +50% Hit Prob:{' '}
                        {forecast.fiftyPctReachProbability}%
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed font-medium text-slate-200">
                      {forecast.forecastSummaryMl}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/10 text-[10px] font-mono text-slate-300">
                      <div>
                        <span className="text-slate-400 block">30D Algo Target:</span>
                        <strong className="text-emerald-300">
                          ₹{forecast.expectedTarget30d.toFixed(2)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Support / Resist:</span>
                        <strong className="text-cyan-300">
                          ₹{forecast.supportLevel} / ₹{forecast.resistanceLevel}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">20D / 50D EMA:</span>
                        <strong className="text-slate-200">
                          ₹{forecast.ema20} / ₹{forecast.ema50}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">14D RSI & Action:</span>
                        <strong className="text-amber-300">
                          RSI {forecast.rsi14} · {forecast.recommendedAction.replace(/_/g, ' ')}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                  <div className="text-[11px] text-slate-400">
                    <span>{language === 'ml' ? 'നിലവിലെ മൂല്യം' : 'Cur Value'}: </span>
                    <strong className="text-slate-200 font-mono">
                      ₹{currentVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onViewChart && (
                      <button
                        type="button"
                        onClick={() =>
                          onViewChart(h.symbol, (h as any).instrumentKey || `NSE_EQ|${h.symbol}`, {
                            symbol: h.symbol,
                            buyPrice: avgPx,
                            currentLTP: curLtp,
                            pnl: pnl,
                            isOption: false,
                          })
                        }
                        className="px-3 py-1.5 min-h-[36px] rounded-xl bg-gradient-to-r from-indigo-600/35 to-cyan-600/35 hover:from-indigo-600 hover:to-cyan-600 text-cyan-200 hover:text-white border border-cyan-500/40 text-xs font-black transition flex items-center gap-1.5 active:scale-95 touch-manipulation shadow-sm"
                        title={
                          language === 'ml'
                            ? 'ഈ ഓഹരിയുടെ ലൈവ് ചാർട്ട് കാണുക'
                            : 'View Live Stock Chart'
                        }
                      >
                        <BarChart2 className="w-3.5 h-3.5 text-cyan-300" />
                        <span>{language === 'ml' ? '📈 ലൈവ് ചാർട്ട്' : '📈 Live Chart'}</span>
                      </button>
                    )}
                    {onOpenOrderModal && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenOrderModal('BUY', h.symbol, h.currentLTP || 0, {
                              quantity: 1,
                              heldQuantity: h.quantity,
                              productType: 'DELIVERY',
                              instrumentKey: (h as any).instrumentKey,
                            })
                          }
                          className="px-2.5 py-1 min-h-[36px] rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition flex items-center gap-1 active:scale-95 touch-manipulation"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{language === 'ml' ? 'വാങ്ങുക' : 'Buy'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={qty <= 0}
                          onClick={() =>
                            onOpenOrderModal('SELL', h.symbol, h.currentLTP || 0, {
                              quantity: h.quantity || 1,
                              heldQuantity: h.quantity,
                              productType: 'DELIVERY',
                              instrumentKey: (h as any).instrumentKey,
                            })
                          }
                          className="px-2.5 py-1 min-h-[36px] rounded-lg bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-rose-400 border border-rose-500/30 text-[11px] font-bold transition flex items-center gap-1 active:scale-95 touch-manipulation"
                        >
                          <span>{language === 'ml' ? 'വിൽക്കുക' : 'Sell'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </>
);
