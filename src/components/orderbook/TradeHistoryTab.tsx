import React from 'react';
import { Briefcase, Download, RefreshCw, Calendar, Filter, CheckCheck } from 'lucide-react';
import { TradeHistoryCard } from './TradeHistoryCard';
import { calculateTradeCharges } from '../../utils/indicators';
import { CumulativePnLChart } from '../CumulativePnLChart';
import { PerformanceOverviewCard } from '../PerformanceOverviewCard';
import type { Position, Language } from '../../types';
import type { AccountSummary, TradeDateEntry, ViewChartFn } from './types';
interface TradeHistoryTabProps {
  tradeHistory: Position[];
  language: Language;
  onViewChart?: ViewChartFn;
  accountSummary: AccountSummary;
  selectedTradeDateFilter: string;
  setSelectedTradeDateFilter: (v: string) => void;
  availableTradeDates: TradeDateEntry[];
  filteredTradeHistory: Position[];
  onSyncHistoryBrokerage?: () => Promise<void>;
}
export const TradeHistoryTab: React.FC<TradeHistoryTabProps> = ({
  tradeHistory,
  language,
  onViewChart,
  accountSummary,
  selectedTradeDateFilter,
  setSelectedTradeDateFilter,
  availableTradeDates,
  filteredTradeHistory,
  onSyncHistoryBrokerage,
}) => (
  <>
    <div className="space-y-4">
      {/* Performance Overview Card */}
      <PerformanceOverviewCard tradeHistory={tradeHistory} language={language} />
      {/* Visual Overview: Daily Cumulative PnL Line Chart */}
      <CumulativePnLChart tradeHistory={tradeHistory} language={language} />
      {/* Trade History Header Banner & Trade Date Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-cyan-400" />
              <span className="font-extrabold text-white text-xs sm:text-sm">
                {language === 'ml'
                  ? 'പൂർത്തിയായ ട്രേഡുകൾ — വാങ്ങലും വിൽക്കലും ഒരുമിച്ച്'
                  : 'Completed Trades — Buy & Sell Combined'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {language === 'ml'
                  ? `ആകെ ${tradeHistory.length} ട്രേഡുകൾ`
                  : `${tradeHistory.length} Total Trades`}
              </span>
              {onSyncHistoryBrokerage && (
                <button
                  onClick={onSyncHistoryBrokerage}
                  className="ml-auto px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                  title={
                    language === 'ml'
                      ? 'Upstox API-യുമായി ലാഭം ഒത്തുനോക്കുക'
                      : 'Sync Brokerage with Upstox API'
                  }
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{language === 'ml' ? 'ലാഭം കൃത്യമാക്കുക (Sync)' : 'Sync Live Profit'}</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {language === 'ml'
                ? 'താഴെ ഓരോ കാർഡിലും ഒരു ട്രേഡിന്റെ വാങ്ങിയ വിലയും (Entry) വിറ്റ വിലയും (Exit), തീയതിയും, സമയവും ഒന്നിച്ച് കാണാം.'
                : 'Each card below combines both Entry/Buy and Exit/Sell details, trade date, and duration together.'}
            </p>
          </div>
        </div>
        {/* Date Filter Pills */}
        {availableTradeDates.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 shrink-0 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3 text-cyan-400" />
              {language === 'ml' ? 'തീയതി ഫിൽട്ടർ:' : 'Date:'}
            </span>
            <button
              onClick={() => setSelectedTradeDateFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1 shrink-0 ${
                selectedTradeDateFilter === 'ALL'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>
                {language === 'ml'
                  ? `എല്ലാ തീയതികളും (${tradeHistory.length})`
                  : `All Dates (${tradeHistory.length})`}
              </span>
            </button>
            {availableTradeDates.map((d) => (
              <button
                key={d.rawDate}
                onClick={() => setSelectedTradeDateFilter(d.rawDate)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1 shrink-0 ${
                  selectedTradeDateFilter === d.rawDate
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Calendar className="w-3 h-3 text-cyan-400" />
                <span>{d.displayLabel}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-cyan-200">
                  {d.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {filteredTradeHistory.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800/80">
          <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-700" />
          <p className="text-xs font-semibold">
            {selectedTradeDateFilter === 'ALL'
              ? language === 'ml'
                ? 'പൂർത്തിയാക്കിയ ട്രേഡുകൾ ഒന്നും ലഭ്യമല്ല.'
                : 'No completed trades available.'
              : language === 'ml'
                ? 'തിരഞ്ഞെടുത്ത തീയതിയിൽ ട്രേഡുകൾ ഒന്നുമില്ല.'
                : 'No completed trades for selected date.'}
          </p>
          {selectedTradeDateFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedTradeDateFilter('ALL')}
              className="mt-2 text-xs text-indigo-400 hover:underline font-bold"
            >
              {language === 'ml' ? 'എല്ലാ ട്രേഡുകളും കാണുക' : 'Show all trades'}
            </button>
          )}
        </div>
      ) : (
        filteredTradeHistory.map((pos) => (
          <TradeHistoryCard key={pos.id} pos={pos} language={language} onViewChart={onViewChart} />
        ))
      )}
      {tradeHistory.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mt-4">
          <button
            onClick={() => {
              const headers = [
                'Symbol,Type,Quantity,Buy Price,Sell Price,Gross PnL,Net PnL,Close Time',
              ];
              const rows = tradeHistory.map((t) => {
                const gross = t.realizedPnL || 0;
                const isOpt = Boolean(
                  t.isOption ||
                  /\b(CE|PE)\b/i.test(t.symbol || '') ||
                  String(t.instrumentKey || '').includes('FO'),
                );
                const chg =
                  Number(t.brokerageCharges) > 0
                    ? Number(t.brokerageCharges)
                    : calculateTradeCharges(
                        Number(t.buyPrice || 0),
                        Math.max(1, Number(t.quantity || 1)),
                        isOpt,
                        Number(t.sellPrice || t.currentLTP || t.buyPrice || 0),
                      ).roundTripCharges;
                const net = gross - chg;
                return `"${t.symbol}","${t.type || 'BUY'}",${t.quantity},${t.buyPrice || 0},${t.sellPrice || 0},${gross.toFixed(2)},${net.toFixed(2)},"${t.closeTime ? new Date(t.closeTime).toLocaleString('en-IN') : ''}"`;
              });
              const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute(
                'download',
                `AlgoTrading_Journal_${new Date().toISOString().slice(0, 10)}.csv`,
              );
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>
              {language === 'ml' ? 'ട്രേഡിംഗ് ജേർണൽ ഡൗൺലോഡ് (CSV)' : 'Export Trading Journal (CSV)'}
            </span>
          </button>
          <div className="p-3.5 px-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 flex justify-between items-center shadow-lg gap-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-extrabold text-slate-300">Total Net Realized P&L:</span>
            </div>
            <span
              className={`text-base font-black px-3 py-1 rounded-lg bg-black/40 border border-slate-700/50 ${accountSummary.netPnLAfterCharges >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {accountSummary.netPnLAfterCharges >= 0 ? '+' : ''}₹
              {accountSummary.netPnLAfterCharges.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  </>
);
