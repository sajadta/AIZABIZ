import React from 'react';
import { Activity } from 'lucide-react';
import type { Language } from '../../../types';
import type { SupervisorActivePosition } from '../types';

interface ActivePositionsAuditProps {
  positions: SupervisorActivePosition[];
  language: Language;
}

export const ActivePositionsAudit: React.FC<ActivePositionsAuditProps> = ({
  positions,
  language,
}) => (
  <>
    {/* Active Open Positions Real-Time Peak-Lock Audit */}
    {positions.length > 0 && (
      <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 space-y-2">
        <h5 className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>
            {language === 'ml'
              ? 'നിലവിലെ ഓപ്പൺ ട്രേഡുകളുടെ തത്സമയ പരിശോധന (Live Position Audit)'
              : 'Active Open Trades Live Peak-Lock Audit'}
          </span>
        </h5>
        <div className="space-y-2">
          {positions.map((ap, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-lg bg-slate-950/90 border border-emerald-500/30 text-[11px] font-mono space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-white">{ap.symbol}</span>
                <span className="text-emerald-400 font-bold">
                  Buy: ₹{Number(ap.buyPrice).toFixed(2)} | LTP: ₹{Number(ap.currentLTP).toFixed(2)}{' '}
                  | Peak: ₹{Number(ap.highestLTP).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>
                  Auto-Moving SL:{' '}
                  <strong className="text-amber-300">
                    ₹{Number(ap.autoStopLoss || 0).toFixed(2)} ↑
                  </strong>
                </span>
                <span>
                  Target:{' '}
                  <strong className="text-cyan-300">
                    ₹{Number(ap.autoTarget || 0).toFixed(2)}
                  </strong>
                </span>
              </div>
              <div className="text-[10px] text-slate-300 pt-1 border-t border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">തത്സമയ അവസ്ഥ:</span>
                <span
                  className={
                    ap.currentNetProfit >= 0
                      ? 'text-emerald-400 font-bold'
                      : 'text-amber-300 font-bold'
                  }
                >
                  {ap.currentNetProfit >= 0
                    ? `+₹${ap.currentNetProfit.toFixed(2)} ലാഭത്തിൽ`
                    : `-₹${Math.abs(ap.currentNetProfit).toFixed(2)} റിസ്ക് മോണിറ്ററിംഗ്`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </>
);
