import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { Language } from '../../../types';
import type { SupervisorAudit } from '../types';

interface TradeForensicsAuditProps {
  audit: SupervisorAudit | null;
  language: Language;
}

/** Per-trade forensics: root cause of the result and whether the fix is applied. */
export const TradeForensicsAudit: React.FC<TradeForensicsAuditProps> = ({ audit, language }) => (
  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
    <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
      <BarChart3 className="w-4 h-4 text-cyan-400" />
      <span>
        {language === 'ml'
          ? 'ട്രേഡ് ഫോറൻസിക് ഓഡിറ്റ് (ലാഭ-നഷ്ട കാരണങ്ങളും പരിഹാരവും)'
          : 'Trade Forensics Audit (Profit/Loss Root Cause & Peak Capture)'}
      </span>
    </h5>
    {!audit?.tradeDiagnostics || audit.tradeDiagnostics.length === 0 ? (
      <p className="text-xs text-slate-400">
        {language === 'ml'
          ? 'ട്രേഡുകൾ നടക്കുമ്പോൾ ഓരോ ട്രേഡിന്റെയും ലാഭ-നഷ്ട കാരണവും പീക്ക് പ്രോഫിറ്റ് ഓഡിറ്റും ഇവിടെ കാണാം.'
          : 'Individual trade forensics will appear here as trades are executed.'}
      </p>
    ) : (
      <div className="space-y-2">
        {audit.tradeDiagnostics.map((td: any, idx: number) => (
          <div
            key={td.id || idx}
            className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
              td.netPnL >= 0
                ? 'bg-emerald-950/15 border-emerald-500/30'
                : 'bg-rose-950/15 border-rose-500/30'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 font-mono">
              <span className="font-black text-white">
                {td.symbol} ({td.quantity} Qty)
              </span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-slate-300">
                  ₹{td.buyPrice} → ₹{td.sellPrice} (Peak: ₹{td.peakLTP})
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-black ${
                    td.netPnL >= 0
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  Net: {td.netPnL >= 0 ? '+' : ''}₹{td.netPnL}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-300">
              <strong className="text-cyan-300">കണ്ടെത്തൽ:</strong> {td.diagnosisMl}
            </p>
            <p className="text-[10px] text-emerald-300">
              <strong>പരിഹാരം:</strong> {td.fixStatusMl}
            </p>
          </div>
        ))}
      </div>
    )}
  </div>
);
