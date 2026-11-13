import React from 'react';
import { Info, BarChart3, LineChart } from 'lucide-react';
import type { Language, Position } from '../../types';

interface BacktestTabProps {
  language: Language;
  tradeHistory: Position[];
}
export const BacktestTab: React.FC<BacktestTabProps> = ({ language, tradeHistory }) => {
  const totalTrades = tradeHistory.length;
  const winningTrades = tradeHistory.filter((t) => (t.realizedPnL || 0) > 0);
  const losingTrades = tradeHistory.filter((t) => (t.realizedPnL || 0) < 0);
  const winRate = totalTrades > 0 ? ((winningTrades.length / totalTrades) * 100).toFixed(1) : '0.0';
  const totalNetProfit = tradeHistory.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
  const grossProfit = winningTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0));
  const totalBrokerageCharges = tradeHistory.reduce((sum, t) => {
    const chg = Number((t as any).brokerageCharges || 0);
    if (chg > 0) return sum + chg;
    const buyVal = Number(t.buyPrice || 0) * Math.max(1, Number(t.quantity || 1));
    const sellVal =
      Number(t.sellPrice || t.currentLTP || t.buyPrice || 0) * Math.max(1, Number(t.quantity || 1));
    const est = 40 + sellVal * 0.00125 + (buyVal + sellVal) * 0.0005 + 40 * 0.18;
    return sum + est;
  }, 0);
  const netProfitAfterCharges = totalNetProfit - totalBrokerageCharges;
  const profitFactor =
    grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '∞' : '0.00';
  const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
  const winLossRatio =
    avgLoss > 0 ? `1 : ${(avgWin / avgLoss).toFixed(1)}` : avgWin > 0 ? '1 : ∞' : '0 : 0';
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border border-amber-800/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-white">
                {language === 'ml'
                  ? 'യഥാർത്ഥ ട്രേഡ് പെർഫോമൻസ് ഓഡിറ്റ് (Live Audit)'
                  : 'Real Trade Performance Audit'}
              </h4>
              <p className="text-[10px] text-slate-300">
                {language === 'ml'
                  ? `നിങ്ങളുടെ അക്കൗണ്ടിൽ നടന്ന ${totalTrades} യഥാർത്ഥ ട്രേഡുകളുടെ കണക്ക് (0% ഡമ്മി ഡാറ്റ)`
                  : `Calculated strictly from ${totalTrades} real executed trades (0% Dummy Data)`}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-mono">
            {winRate}% WIN RATE
          </span>
        </div>
        {/* Clarification banner explaining this is an automated audit report, not a manual backend testing prerequisite */}
        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2 text-xs text-slate-300">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {language === 'ml'
              ? 'ഇത് നിങ്ങളുടെ അക്കൗണ്ടിൽ നടന്ന യഥാർത്ഥ ട്രേഡുകളുടെ പ്രകടന റിപ്പോർട്ടാണ്. ട്രേഡിങ്ങിനായി നിങ്ങൾ ഒന്നും മാനുവലായി ബാക്ക്-ടെസ്റ്റ് ചെയ്യേണ്ടതില്ല — ബോട്ട് സ്വയം തത്സമയം വിശകലനം ചെയ്ത് ട്രേഡ് ചെയ്യും.'
              : 'This is an automated performance audit report of executed trades. No manual backtesting is required to trade — the algo trades autonomously.'}
          </span>
        </div>
        {/* Real Stats overview: Total Profit, Total Loss, Total Brokerage Charges, Net P&L */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/50">
            <span className="text-[10px] text-emerald-300 block font-semibold">
              {language === 'ml' ? 'ആകെ ലാഭം (Total Profit)' : 'Total Profit (Gross)'}
            </span>
            <span className="text-lg font-black font-mono mt-0.5 block text-emerald-400">
              +₹{grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-slate-400">Wins: {winningTrades.length} Trades</span>
          </div>
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/50">
            <span className="text-[10px] text-rose-300 block font-semibold">
              {language === 'ml' ? 'ആകെ നഷ്ടം (Total Loss)' : 'Total Loss (Gross)'}
            </span>
            <span className="text-lg font-black font-mono mt-0.5 block text-rose-400">
              -₹{grossLoss.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-slate-400">Losses: {losingTrades.length} Trades</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50">
            <span className="text-[10px] text-amber-300 block font-semibold">
              {language === 'ml' ? 'ആകെ ബ്രോക്കറേജ് & ടാക്സ്' : 'Total Brokerage Charges'}
            </span>
            <span className="text-lg font-black font-mono text-amber-400 mt-0.5 block">
              ₹{totalBrokerageCharges.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
            <span className="text-[9px] text-slate-400">Upstox Brokerage + Taxes</span>
          </div>
          <div className="p-3 rounded-xl bg-black/40 border border-slate-800">
            <span className="text-[10px] text-cyan-300 block font-semibold">
              {language === 'ml' ? 'അറ്റ ലാഭം (Net P&L)' : 'Net P&L (After Charges)'}
            </span>
            <span
              className={`text-lg font-black font-mono mt-0.5 block ${netProfitAfterCharges >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {netProfitAfterCharges >= 0 ? '+' : '-'}₹
              {Math.abs(netProfitAfterCharges).toLocaleString('en-IN', {
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[9px] text-slate-500">
              PF: {profitFactor} | W/L: {winLossRatio}
            </span>
          </div>
        </div>
      </div>
      {/* Real Executed Trades Breakdown Table */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
          <LineChart className="w-4 h-4 text-emerald-400" />
          <span>
            {language === 'ml'
              ? 'യഥാർത്ഥ ട്രേഡ് ചരിത്രം (Real Trade Log)'
              : 'Real Executed Trade Log'}
          </span>
        </h4>
        {tradeHistory.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl">
            {language === 'ml'
              ? 'ഇതുവരെ പൂർത്തിയാക്കിയ ട്രേഡുകൾ ഇല്ല. ട്രേഡുകൾ നടക്കുമ്പോൾ യഥാർത്ഥ ലാഭ-നഷ്ട കണക്കുകൾ ഇവിടെ തനിയെ അപ്‌ഡേറ്റ് ആകും (ഡമ്മി ഡാറ്റ ഒഴിവാക്കിയിരിക്കുന്നു).'
              : 'No completed trades recorded yet. Real trade statistics will appear here automatically once trades are executed.'}
          </div>
        ) : (
          <div className="overflow-x-auto text-xs font-mono">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Qty</th>
                  <th className="pb-2">Buy / Sell</th>
                  <th className="pb-2 text-right">Realized P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {tradeHistory.slice(0, 15).map((tr, i) => {
                  const pnl = tr.realizedPnL || 0;
                  return (
                    <tr key={tr.id || i}>
                      <td className="py-2 text-white font-bold">{tr.symbol}</td>
                      <td className="py-2 text-slate-300">{tr.quantity}</td>
                      <td className="py-2 text-slate-400">
                        ₹{Number(tr.buyPrice || 0).toFixed(1)} → ₹
                        {Number(tr.sellPrice || tr.currentLTP || 0).toFixed(1)}
                      </td>
                      <td
                        className={`py-2 text-right font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
