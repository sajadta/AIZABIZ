import React, { useState } from 'react';
import { Briefcase, TrendingUp, TrendingDown, AlertOctagon, Clock, CheckCircle2, XCircle, PieChart, Plus, Download, RefreshCw, BarChart2, Calendar, Sparkles, Filter, CheckCheck, Zap, Check, Lock, Edit2, X, Target } from 'lucide-react';
import { Order, Position, Holding, Language } from '../types';
import { translations } from '../translations';
import { CumulativePnLChart } from './CumulativePnLChart';
import { PerformanceOverviewCard } from './PerformanceOverviewCard';
import { calculateTradeCharges } from '../utils/indicators';

interface OrderBookPositionsProps {
  positions: Position[];
  orders: Order[];
  tradeHistory?: Position[];
  holdings?: Holding[];
  language: Language;
  onSquareOffPosition: (positionId: string) => void;
  onSquareOffAll: () => void;
  totalPnL: number;
  initialTab?: 'POSITIONS' | 'HOLDINGS' | 'ORDERS' | 'TRADE_HISTORY';
  onOpenOrderModal?: (
    type: 'BUY' | 'SELL',
    symbol: string,
    price: number,
    options?: {
      quantity?: number;
      heldQuantity?: number;
      productType?: 'INTRADAY' | 'DELIVERY';
      instrumentKey?: string;
    }
  ) => void;
  onRefreshHoldings?: () => void;
  isConnected?: boolean;
  onOpenApiModal?: () => void;
  onViewChart?: (symbol: string, instrumentKey?: string, context?: any) => void;
  onSyncHistoryBrokerage?: () => Promise<void>;
}

// Helper to format trade timestamps into clear dates and times in Malayalam and English
export const formatTradeDateTime = (dateVal?: string | number, lang: Language = 'ml') => {
  if (!dateVal) return { dateStr: '—', timeStr: '—', fullStr: '—', rawDate: '' };
  try {
    let d: Date;
    if (typeof dateVal === 'number') {
      d = new Date(dateVal);
    } else {
      // If it is an ISO string or time string
      if (/^\d{1,2}:\d{2}/.test(dateVal) && !dateVal.includes('-') && !dateVal.includes('T')) {
        return { dateStr: '', timeStr: dateVal, fullStr: dateVal, rawDate: '' };
      }
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) {
      return { dateStr: '', timeStr: String(dateVal), fullStr: String(dateVal), rawDate: '' };
    }
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsMl = ['ജനു', 'ഫെബ്രു', 'മാർച്ച്', 'ഏപ്രിൽ', 'മെയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റം', 'ഒക്ടോ', 'നവം', 'ഡിസം'];
    const month = lang === 'ml' ? monthsMl[d.getMonth()] : monthsEn[d.getMonth()];
    const dateStr = `${d.getDate()} ${month} ${d.getFullYear()}`;
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const rawDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return {
      dateStr,
      timeStr,
      fullStr: `${dateStr}, ${timeStr}`,
      rawDate
    };
  } catch {
    return { dateStr: '', timeStr: String(dateVal), fullStr: String(dateVal), rawDate: '' };
  }
};

// Helper to calculate duration between trade entry and exit
export const getTradeDuration = (openedVal?: string | number, closeVal?: string | number, lang: Language = 'ml') => {
  if (!openedVal || !closeVal) return null;
  try {
    const start = typeof openedVal === 'number' ? openedVal : new Date(openedVal).getTime();
    const end = typeof closeVal === 'number' ? closeVal : new Date(closeVal).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return null;
    const diffSecs = Math.floor((end - start) / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return lang === 'ml' ? `${diffDays} ദിവസം ${diffHours % 24} മണി` : `${diffDays}d ${diffHours % 24}h`;
    }
    if (diffHours > 0) {
      return lang === 'ml' ? `${diffHours} മണി ${diffMins % 60} മി` : `${diffHours}h ${diffMins % 60}m`;
    }
    if (diffMins > 0) {
      return lang === 'ml' ? `${diffMins} മിനിറ്റ് ${diffSecs % 60} സെക്കൻഡ്` : `${diffMins}m ${diffSecs % 60}s`;
    }
    return lang === 'ml' ? `${diffSecs} സെക്കൻഡ്` : `${diffSecs}s`;
  } catch {
    return null;
  }
};

// Helper to translate exit reason into clean, accurate user-friendly labels (never mislabels losses as Target Profit!)
export const translateExitReason = (
  reason?: string,
  lang: Language = 'ml',
  netPnL?: number,
  grossPnL?: number
) => {
  const isMl = lang === 'ml';

  // 1. IF NET & GROSS ARE BOTH NEGATIVE:
  // It is mathematically impossible for this to be a Target Profit or Profit Booking!
  // It MUST be labeled as Stop-Loss, Reversal Guard, or Breakeven Protection.
  if (netPnL !== undefined && netPnL < 0 && (grossPnL === undefined || grossPnL <= 0)) {
    const r = (reason || '').toLowerCase();
    if (r.includes('reversal') || r.includes('invalidation') || r.includes('reversed')) {
      return isMl ? '🛡️ ട്രെൻഡ് റിവേഴ്സൽ പരിരക്ഷ (നഷ്ടം ഒഴിവാക്കി)' : '🛡️ Trend Reversal Guard (Cut Loss)';
    }
    if (r.includes('stagnation') || r.includes('ejector') || r.includes('paused') || r.includes('zero-loss')) {
      return isMl ? '⚖️ സ്റ്റാഗ്നേഷൻ കട്ട് (നഷ്ടം പരിമിതപ്പെടുത്തി)' : '⚖️ Stagnation Cut (Loss Minimized)';
    }
    if (r.includes('trailing') || r.includes('ratchet') || r.includes('auto-moving')) {
      return isMl ? '🛡️ ട്രെയിലിംഗ് സ്റ്റോപ്പ്-ലോസ് എക്സിറ്റ്' : '🛡️ Trailing Stop-Loss Exit';
    }
    return isMl ? '🛡️ സ്റ്റോപ്പ്-ലോസ് പരിരക്ഷ (നഷ്ടം പരിമിതപ്പെടുത്തി)' : '🛡️ Stop-Loss Risk Protection';
  }

  // 2. IF GROSS PnL IS ZERO OR SLIGHTLY POSITIVE, BUT NET PnL IS NEGATIVE (Because of Brokerage/Taxes):
  // Realized Gross is ~₹0, but Brokerage of ₹10-₹40 made Net Realized negative:
  if (netPnL !== undefined && netPnL < 0 && grossPnL !== undefined && grossPnL >= 0) {
    return isMl ? '⚖️ ബ്രേക്ക്-ഈവൻ എക്സിറ്റ് (ബ്രോക്കറേജ്/ടാക്സ് മാത്രം)' : '⚖️ Breakeven Exit (Taxes & Brokerage Only)';
  }

  // 3. IF NO REASON STRING PROVIDED:
  if (!reason) {
    if (netPnL !== undefined) {
      if (netPnL > 10) return isMl ? '🎯 ലാഭം ബുക്ക് ചെയ്തു' : '🎯 Profit Booked';
      if (netPnL < -10) return isMl ? '🛡️ സ്റ്റോപ്പ്-ലോസ് എക്സിറ്റ്' : '🛡️ Stop-Loss Exit';
      return isMl ? '⚖️ ബ്രേക്ക്-ഈവൻ എക്സിറ്റ്' : '⚖️ Breakeven Exit';
    }
    return isMl ? 'സിസ്റ്റം ഓട്ടോ എക്സിറ്റ്' : 'System Auto Exit';
  }

  const r = reason.toLowerCase();

  // 4. Genuine Target Profit (ONLY IF netPnL > 0 AND grossPnL > 0!)
  const isTargetWord = r.includes('target') || r.includes('take-profit') || r.includes('take profit') || /\btp\b/i.test(reason);
  if (isTargetWord) {
    if (netPnL !== undefined && netPnL > 0) {
      return isMl ? '🎯 ടാർഗറ്റ് പ്രോഫിറ്റ് കൈവരിച്ചു' : '🎯 Target Profit Hit';
    }
    if (netPnL !== undefined && netPnL <= 0) {
      return isMl ? '⚖️ ബ്രേക്ക്-ഈവൻ എക്സിറ്റ് (ക്യാപിറ്റൽ സേഫ്)' : '⚖️ Breakeven Exit (Capital Preserved)';
    }
    return isMl ? '🎯 ടാർഗറ്റ് പ്രോഫിറ്റ് കൈവരിച്ചു' : '🎯 Target Profit Hit';
  }

  // 5. Breakeven / Stagnation Ejector Exits
  if (
    r.includes('zero-loss') ||
    r.includes('ejector') ||
    r.includes('stagnation') ||
    r.includes('breakeven') ||
    r.includes('breakout paused') ||
    r.includes('cost to preserve') ||
    r.includes('cost to eliminate')
  ) {
    if (netPnL !== undefined && netPnL < 0) {
      return isMl ? '⚖️ ബ്രേക്ക്-ഈവൻ എക്സിറ്റ് (ചിലവ് മാത്രം)' : '⚖️ Breakeven Exit (Brokerage Only)';
    }
    return isMl ? '⚖️ ബ്രേക്ക്-ഈവൻ പ്രൊട്ടക്ഷൻ' : '⚖️ Breakeven Protection';
  }

  // 6. Trend / Parameter Reversal Invalidation
  if (
    r.includes('invalidation') ||
    r.includes('parameter reversal') ||
    r.includes('parameters reversed') ||
    r.includes('trend reversal')
  ) {
    return isMl ? '🛡️ ട്രെൻഡ് റിവേഴ്സൽ പരിരക്ഷ' : '🛡️ Trend Reversal Guard';
  }

  // 7. Stop-Loss (Strict, Smart, or Max Loss Protection)
  if (
    r.includes('strict stop') ||
    r.includes('smart stop') ||
    r.includes('stop-loss hit') ||
    r.includes('sl hit') ||
    r.includes('stoploss') ||
    r.includes('below auto-sl') ||
    r.includes('prevent further loss') ||
    r.includes('minimize loss')
  ) {
    return isMl ? '🛡️ റിസ്ക് പ്രൊട്ടക്ഷൻ സ്റ്റോപ്പ്-ലോസ്' : '🛡️ Risk Protection Stop-Loss';
  }

  // 7b. Peak Harvester (Top Climax Reversal / ATR Pullback Top Capture)
  if (
    r.includes('volatility-adaptive') ||
    r.includes('peak harvester') ||
    r.includes('top harvest') ||
    r.includes('climax') ||
    r.includes('top exhaustion')
  ) {
    return isMl ? '🏆 പീക്ക് ഹാർവെസ്റ്റർ (മാക്സിമം ടോപ്പ് ലാഭം നേടി)' : '🏆 Peak Harvester (Top Profit Captured)';
  }

  // 8. Trailing Stop-Loss / Peak Ratchet Lock
  if (
    r.includes('trailing') ||
    r.includes('auto-moving') ||
    r.includes('ratchet') ||
    r.includes('peak-locked') ||
    r.includes('peak locked')
  ) {
    if (netPnL !== undefined && netPnL > 10) {
      return isMl ? '📈 ട്രെയിലിംഗ് സ്റ്റോപ്പ്-ലോസ് (ലാഭം ലോക്ക് ചെയ്തു)' : '📈 Trailing Stop-Loss (Locked Profit)';
    }
    if (netPnL !== undefined && netPnL < -10) {
      return isMl ? '🛡️ സ്റ്റോപ്പ്-ലോസ് എക്സിറ്റ്' : '🛡️ Stop-Loss Exit';
    }
    return isMl ? '⚖️ ബ്രേക്ക്-ഈവൻ പ്രൊട്ടക്ഷൻ' : '⚖️ Breakeven Protection';
  }

  // 9. Intraday Market Auto Square-Off
  if (r.includes('square') || r.includes('market close') || r.includes('15:15') || r.includes('15:20')) {
    return isMl ? '⏰ മാർക്കറ്റ് ക്ലോസിംഗ് സ്ക്വയർ-ഓഫ്' : '⏰ Market Auto Square-Off';
  }

  // 10. Manual Square-Off
  if (r.includes('manual')) {
    return isMl ? '👤 മാനുവൽ എക്സിറ്റ്' : '👤 Manual Square-Off';
  }

  // Fallback based on PnL
  if (netPnL !== undefined) {
    if (netPnL > 10) return isMl ? '🎯 ലാഭം ബുക്ക് ചെയ്തു' : '🎯 Profit Booked';
    if (netPnL < -10) return isMl ? '🛡️ സ്റ്റോപ്പ്-ലോസ് എക്സിറ്റ്' : '🛡️ Stop-Loss Exit';
    return isMl ? '⚖️ ബ്രേക്ക്-ഈവൻ എക്സിറ്റ്' : '⚖️ Breakeven Exit';
  }

  return reason.length > 50 ? (isMl ? 'സിസ്റ്റം ഓട്ടോ എക്സിറ്റ്' : 'System Auto Exit') : reason;
};

const PositionItem: React.FC<{
  pos: Position;
  onSquareOff: (id: string) => void;
  isNew?: boolean;
  onViewChart?: (symbol: string, instrumentKey?: string, context?: any) => void;
  language?: Language;
}> = ({ pos, onSquareOff, isNew, onViewChart, language = 'ml' }) => {
  const isOpt = pos.isOption !== false;
  const buyPx = Math.max(0, Number(pos.buyPrice || 0));
  const curPx = Number(pos.currentLTP || buyPx);
  const qty = Math.max(1, Number(pos.quantity || 1));

  // Immediate, reliable local charges calculation (zero network delay or failure risk)
  const defaultCharges = React.useMemo(() => {
    const breakdown = calculateTradeCharges(buyPx, qty, isOpt, curPx);
    return {
      total: breakdown.roundTripCharges,
      details: {
        brokerage: breakdown.buyBrokerage + breakdown.sellBrokerage,
        stt: breakdown.stt,
        gst: breakdown.gst,
        stampDuty: breakdown.stampDuty,
        transactionCharge: breakdown.exchangeTxnCharge,
        sebiCharge: breakdown.sebiCharge,
      }
    };
  }, [buyPx, qty, isOpt, curPx]);

  const [apiCharges, setApiCharges] = React.useState<{ total: number; details: any; isLiveUpstox?: boolean } | null>(null);
  const [showTaxBreakdown, setShowTaxBreakdown] = React.useState(false);

  const estCharges = apiCharges?.total ?? defaultCharges.total;
  const chargeDetails = apiCharges?.details ?? defaultCharges.details;

  React.useEffect(() => {
    let isMounted = true;
    const fetchCharges = async () => {
      try {
        if (!pos.buyPrice || !pos.quantity) return;
        const instToken = pos.instrumentKey || (pos.isOption ? 'NSE_FO|' + pos.symbol : 'NSE_EQ|' + pos.symbol);
        const prod = pos.productType || 'D';
        const currentPx = pos.currentLTP || pos.buyPrice;

        // Fetch Live Round-Trip Brokerage & Taxes directly from Upstox API via server cache
        const r = await fetch(
          `/api/market/brokerage?instrumentToken=${encodeURIComponent(instToken)}&quantity=${pos.quantity}&product=${prod}&buyPrice=${pos.buyPrice}&sellPrice=${currentPx}&roundTrip=true`
        );
        if (r.ok) {
          const d = await r.json();
          const charges = d?.data?.charges;
          if (isMounted && charges && Number(charges.total) > 0) {
            setApiCharges({
              total: Number(charges.total),
              details: {
                brokerage: Number(charges.brokerage || 60),
                stt: Number(charges.taxes?.stt || 0),
                gst: Number(charges.taxes?.gst || 0),
                stampDuty: Number(charges.taxes?.stamp_duty ?? charges.taxes?.stampDuty ?? 0),
                transactionCharge: Number(charges.other_charges?.transaction ?? charges.taxes?.transactionCharge ?? 0),
                sebiCharge: Number(charges.other_charges?.sebi_turnover ?? charges.taxes?.sebiCharge ?? 0),
              },
              isLiveUpstox: Boolean(d?.isLiveUpstox || d?.data?.source === 'UPSTOX_LIVE_API'),
            });
            return;
          }
        }
      } catch {
        // Fallback already safely active from defaultCharges
      }
    };
    fetchCharges();
    return () => { isMounted = false; };
  }, [pos.symbol, pos.buyPrice, pos.currentLTP, pos.quantity, pos.productType]);

  const gross = pos.pnl || 0;
  const net = estCharges !== null ? gross - estCharges : gross;
  const target50Px = Number((buyPx * 1.5).toFixed(2));
  const target50Profit = Number(((target50Px - buyPx) * qty).toFixed(2));
  const is50PctHit = buyPx > 0 && curPx >= target50Px;
  const progressTo50 = buyPx > 0 ? Math.max(0, Math.min(100, ((curPx - buyPx) / (buyPx * 0.5)) * 100)) : 0;
  const isHighProfit = net >= 1000 || is50PctHit;

  return (
      <div className={`p-0 rounded-2xl border transition-all duration-500 backdrop-blur-md relative overflow-hidden group shadow-[0_8px_30px_rgb(0,0,0,0.4)] ${
        is50PctHit
          ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
          : isHighProfit
            ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
            : gross < 0
              ? 'bg-rose-500/10 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
              : 'bg-slate-900/60 border-slate-800/60 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)]'
      }`}>
        <div className={`absolute inset-0 bg-gradient-to-tr ${gross >= 0 ? 'from-emerald-500/5' : 'from-rose-500/5'} to-transparent pointer-events-none opacity-40`} />
        
        {/* Glow accent bar at top */}
        <div className={`h-1 w-full ${is50PctHit ? 'bg-amber-500' : isHighProfit ? 'bg-emerald-500' : gross < 0 ? 'bg-rose-500' : 'bg-slate-700'} shadow-[0_0_15px_rgba(0,0,0,0.5)]`} />

        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-xl border shrink-0 ${
                isOpt ? 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                {isOpt ? <Zap className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-white truncate tracking-tight">
                    {pos.symbol}
                  </span>
                  {isNew && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[8px] font-black uppercase animate-pulse">NEW</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-800/40 px-2 py-0.5 rounded">
                    {pos.productType === 'DELIVERY' ? 'Delivery' : 'Intraday'}
                  </span>
                  {pos.isBtstHoldRecommended && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> BTST HOLD
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">
                    Qty: {pos.quantity}
                  </span>

                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
              {onViewChart && (
                <button
                  type="button"
                  onClick={() => onViewChart(pos.symbol, pos.instrumentKey)}
                  className="h-10 px-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition flex items-center gap-2 active:scale-95 shadow-lg shadow-black/20"
                >
                  <BarChart2 className="w-4 h-4" />
                  <span className="text-[11px] font-black uppercase hidden sm:inline">{language === 'ml' ? 'ചാർട്ട്' : 'Chart'}</span>
                </button>
              )}
              <button
                onClick={() => onSquareOff(pos.id)}
                className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black uppercase border border-rose-500/50 transition active:scale-95 shadow-lg shadow-rose-950/40"
              >
                {language === 'ml' ? 'എക്സിറ്റ്' : 'Exit'}
              </button>
            </div>
          </div>

          {/* Unified horizontal integrated data strip (No separate boxes) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-y-4 gap-x-6 py-4 px-5 rounded-2xl bg-black/40 border border-slate-800/40 shadow-inner group-hover:border-slate-700/60 transition-colors">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-slate-500" /> Buy Price
              </span>
              <span className="text-slate-200 font-black font-mono text-sm">₹{buyPx.toFixed(2)}</span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-cyan-400" /> LTP
              </span>
              <span className="text-white font-black font-mono text-sm">₹{curPx.toFixed(2)}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-amber-500" /> Target
              </span>
              <span className="text-amber-400/90 font-black font-mono text-sm">₹{target50Px.toFixed(2)}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                <div className={`w-1 h-1 rounded-full ${gross >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} /> Gross P&L
              </span>
              <span className={`text-sm font-black font-mono ${gross >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {gross >= 0 ? '+' : ''}₹{gross.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col gap-1 sm:text-right">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5 sm:justify-end">
                <div className={`w-1 h-1 rounded-full ${net >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} /> Net Profit
              </span>
              <span className={`text-base font-black font-mono ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'} drop-shadow-[0_0_12px_rgba(52,211,153,0.3)] flex items-center gap-1`}>
                {apiCharges?.isLiveUpstox && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Upstox Live API Verified" />}
                {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Progress to Target */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Target className="w-3 h-3 text-amber-500" />
                {language === 'ml' ? 'ലാഭ ലക്ഷ്യം' : 'Profit Target'}: <span className="text-slate-200">₹{target50Px} (+50%)</span>
              </span>
              <span className={is50PctHit ? 'text-amber-400' : 'text-cyan-400'}>
                {progressTo50.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
              <div 
                className={`h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(34,211,238,0.2)] ${
                  is50PctHit ? 'bg-gradient-to-r from-emerald-500 to-amber-400' : 'bg-gradient-to-r from-cyan-600 to-emerald-500'
                }`}
                style={{ width: `${progressTo50}%` }}
              />
            </div>
          </div>
        </div>

        {/* Dynamic status labels at bottom */}
        <div className="px-5 py-2.5 bg-black/40 border-t border-slate-800/40 flex items-center justify-between text-[10px] font-bold">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3 h-3" />
              {pos.openedAt}
            </span>
            <span className={`flex items-center gap-1.5 ${net >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
              {net >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {net >= 0 ? (language === 'ml' ? 'ലാഭത്തിൽ' : 'In Profit') : (language === 'ml' ? 'നഷ്ടത്തിൽ' : 'In Loss')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 flex items-center gap-1">
              {apiCharges?.isLiveUpstox && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Upstox Live API" />}
              {language === 'ml' ? 'ബ്രോക്കറേജ് & നികുതി' : 'Brokerage & Taxes'}: ₹{estCharges.toFixed(2)}
            </span>
            {showTaxBreakdown ? (
              <button onClick={() => setShowTaxBreakdown(false)} className="text-cyan-500 hover:text-cyan-400 uppercase tracking-tighter text-[9px] font-black flex items-center gap-1">
                {apiCharges?.isLiveUpstox && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {language === 'ml' ? 'മറയ്ക്കുക' : 'Hide'}
              </button>
            ) : (
              <button onClick={() => setShowTaxBreakdown(true)} className="text-slate-400 hover:text-cyan-400 uppercase tracking-tighter text-[9px] font-black flex items-center gap-1">
                {apiCharges?.isLiveUpstox && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {language === 'ml' ? 'വിശദാംശങ്ങൾ' : 'View Details'}
              </button>
            )}
          </div>
        </div>

        {showTaxBreakdown && chargeDetails && (
          <div className="p-4 bg-black/80 border-t border-cyan-900/30 text-[10px] font-mono grid grid-cols-2 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="col-span-full pb-1 border-b border-slate-800/60 flex items-center justify-between text-[9px]">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                ⚡ {language === 'ml' ? 'Upstox ലൈവ് ഒഫീഷ്യൽ ബ്രോക്കറേജ് (Exact Match)' : 'Upstox Live Official Brokerage API'}
              </span>
              <span className="text-slate-400">Total: ₹{estCharges.toFixed(2)}</span>
            </div>
            {Object.entries(chargeDetails).map(([key, val]: [string, any]) => (
              <div key={key} className="flex flex-col">
                <span className="text-slate-500 uppercase text-[8px]">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="text-slate-300 font-bold">₹{Number(val || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
  );
};

const TradeHistoryItem: React.FC<{
  pos: Position;
  index: number;
  onViewChart?: (symbol: string, instrumentKey?: string, context?: any) => void;
  language?: Language;
}> = ({ pos, index, onViewChart, language = 'ml' }) => {
  const isOpt = pos.isOption !== false;
  const buyPx = Math.max(0, Number(pos.buyPrice || 0));
  const sellPx = Number(pos.sellPrice || pos.currentLTP || buyPx);
  const qty = Math.max(1, Number(pos.quantity || 1));

  const estCharges = React.useMemo(() => {
    if (Number((pos as any).brokerageCharges) > 0) {
      return Number((pos as any).brokerageCharges);
    }
    return calculateTradeCharges(buyPx, qty, isOpt, sellPx).roundTripCharges;
  }, [(pos as any).brokerageCharges, buyPx, qty, isOpt, sellPx]);

  const gross = pos.realizedPnL || 0;
  const net = gross - estCharges;

  return (
      <div className="p-0 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700/60 transition-all duration-300 relative overflow-hidden group shadow-lg">
        <div className={`absolute inset-0 bg-gradient-to-tr ${gross >= 0 ? 'from-emerald-500/5' : 'from-rose-500/5'} to-transparent pointer-events-none opacity-30`} />
        
        <div className="p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg border ${
                gross >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                {gross >= 0 ? <CheckCheck className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-sm font-black text-white block tracking-tight">{pos.symbol}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{pos.openedAt}</span>
              </div>
            </div>
            {onViewChart && (
              <button
                type="button"
                onClick={() => onViewChart(pos.symbol, pos.instrumentKey)}
                className="p-2 rounded-xl bg-slate-800/40 border border-slate-700/40 text-slate-400 hover:text-white transition"
              >
                <BarChart2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 py-3 px-4 rounded-xl bg-black/30 border border-slate-800/30">
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Buy Px</span>
              <span className="text-slate-300 font-bold font-mono text-xs">₹{buyPx.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Exit Px</span>
              <span className="text-slate-300 font-bold font-mono text-xs">₹{sellPx.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Gross</span>
              <span className={`font-bold font-mono text-xs ${gross >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {gross >= 0 ? '+' : ''}₹{gross.toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Upstox Fees</span>
              <span className="text-slate-400 font-bold font-mono text-xs">-₹{estCharges.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-0.5 sm:text-right">
              <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Net Realized</span>
              <span className={`font-black font-mono text-sm ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'} drop-shadow-[0_0_8px_rgba(52,211,153,0.2)] flex items-center gap-1 justify-end`}>
                {(pos as any).brokerageCharges > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Upstox API Verified" />}
                {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
  );
};

export const OrderBookPositions: React.FC<OrderBookPositionsProps> = ({
  positions,
  orders,
  tradeHistory = [],
  holdings = [],
  language,
  onSquareOffPosition,
  onSquareOffAll,
  totalPnL,
  initialTab = 'POSITIONS',
  onOpenOrderModal,
  onRefreshHoldings,
  isConnected = false,
  onOpenApiModal,
  onViewChart,
  onSyncHistoryBrokerage,
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'POSITIONS' | 'HOLDINGS' | 'ORDERS' | 'TRADE_HISTORY'>(initialTab);
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'OPTIONS' | 'INDEX_EQUITY'>('ALL');

  // Date filter for Trade History (Default: 'ALL' to see all dates, with buttons to pick specific dates like 14 Oct, 15 Oct)
  const [selectedTradeDateFilter, setSelectedTradeDateFilter] = useState<string>('ALL');

  // Orders View Mode: 'PAIRED' (Round-trip Buy & Sell paired together) vs 'INDIVIDUAL' (Raw broker order fills)
  const [ordersViewMode, setOrdersViewMode] = useState<'PAIRED' | 'INDIVIDUAL'>('PAIRED');

  // Holding Buy Price Adjustment & Locking State
  const [editingHoldingSym, setEditingHoldingSym] = useState<string | null>(null);
  const [customBuyPriceInput, setCustomBuyPriceInput] = useState<string>('');
  const [savingBuyPrice, setSavingBuyPrice] = useState<boolean>(false);
  const [buyPriceSaveMessage, setBuyPriceSaveMessage] = useState<string | null>(null);

  const handleSaveCustomBuyPrice = async (symbol: string, isin?: string) => {
    const num = parseFloat(customBuyPriceInput);
    if (isNaN(num) || num <= 0) return;
    setSavingBuyPrice(true);
    try {
      const res = await fetch('/api/market/holdings/set-buy-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, isin, buyPrice: num }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBuyPriceSaveMessage(
          language === 'ml'
            ? `✅ ${symbol} വാങ്ങിയ വില ₹${num.toFixed(2)} ആയി സ്ഥിരപ്പെടുത്തി!`
            : `✅ Successfully locked buy price for ${symbol} at ₹${num.toFixed(2)}!`
        );
        setEditingHoldingSym(null);
        setCustomBuyPriceInput('');
        if (onRefreshHoldings) onRefreshHoldings();
        setTimeout(() => setBuyPriceSaveMessage(null), 4000);
      }
    } catch (e) {
      console.error('Failed to set buy price', e);
    } finally {
      setSavingBuyPrice(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'HOLDINGS' && onRefreshHoldings) {
      onRefreshHoldings();
    }
  }, [activeTab, onRefreshHoldings]);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Compute available trade dates from trade history for instant filtering
  const availableTradeDates = React.useMemo(() => {
    const datesMap = new Map<string, { rawDate: string; displayLabel: string; count: number }>();
    tradeHistory.forEach(t => {
      const dt = formatTradeDateTime(t.openedAtMs || t.closeTime || t.openedAt, language);
      if (dt.rawDate) {
        const existing = datesMap.get(dt.rawDate);
        if (existing) {
          existing.count += 1;
        } else {
          datesMap.set(dt.rawDate, {
            rawDate: dt.rawDate,
            displayLabel: dt.dateStr,
            count: 1
          });
        }
      }
    });
    return Array.from(datesMap.values()).sort((a, b) => b.rawDate.localeCompare(a.rawDate));
  }, [tradeHistory, language]);

  // Filtered trade history based on selected date
  const filteredTradeHistory = React.useMemo(() => {
    if (selectedTradeDateFilter === 'ALL') return tradeHistory;
    return tradeHistory.filter(t => {
      const dt = formatTradeDateTime(t.openedAtMs || t.closeTime || t.openedAt, language);
      return dt.rawDate === selectedTradeDateFilter;
    });
  }, [tradeHistory, selectedTradeDateFilter, language]);

  const filteredPositions = React.useMemo(() => {
    if (positionFilter === 'OPTIONS') {
      return positions.filter(p => p.isOption || p.symbol.includes('CE') || p.symbol.includes('PE'));
    }
    if (positionFilter === 'INDEX_EQUITY') {
      return positions.filter(p => !p.isOption && !p.symbol.includes('CE') && !p.symbol.includes('PE'));
    }
    return positions;
  }, [positions, positionFilter]);

  // Track newly executed orders and positions for visual feedback
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const prevOrderIdsRef = React.useRef<Set<string>>(new Set(orders.map(o => o.id)));
  const prevPositionIdsRef = React.useRef<Set<string>>(new Set(positions.map(p => p.id)));

  React.useEffect(() => {
    const currentOrderIds = new Set(orders.map(o => o.id));
    const newOrders = orders.filter(o => !prevOrderIdsRef.current.has(o.id));

    const currentPositionIds = new Set(positions.map(p => p.id));
    const newPositions = positions.filter(p => !prevPositionIdsRef.current.has(p.id));

    if (newOrders.length > 0 || newPositions.length > 0) {
      const freshIds = new Set<string>();
      newOrders.forEach(o => freshIds.add(o.id));
      newPositions.forEach(p => freshIds.add(p.id));

      setNewlyAddedIds(prev => new Set([...prev, ...freshIds]));

      const timer = setTimeout(() => {
        setNewlyAddedIds(prev => {
          const next = new Set(prev);
          freshIds.forEach(id => next.delete(id));
          return next;
        });
      }, 4000);

      prevOrderIdsRef.current = currentOrderIds;
      prevPositionIdsRef.current = currentPositionIds;

      return () => clearTimeout(timer);
    } else {
      prevOrderIdsRef.current = currentOrderIds;
      prevPositionIdsRef.current = currentPositionIds;
    }
  }, [orders, positions]);

  const totalHoldingsInvested = holdings.reduce(
    (acc, h) => acc + (h.investedValue || (h.quantity * (h.buyPrice ?? h.avgPrice ?? 0))), 
    0
  );
  const totalHoldingsValue = holdings.reduce(
    (acc, h) => acc + (h.currentValue || (h.quantity * (h.currentLTP || 0))), 
    0
  );
  const totalHoldingsPnL = totalHoldingsValue - totalHoldingsInvested;
  const totalHoldingsPnLPercent = totalHoldingsInvested > 0 ? (totalHoldingsPnL / totalHoldingsInvested) * 100 : 0;

  const todayIst = React.useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), []);

  // Compute combined Summary Stats: Separate Today's Trading Performance and Total Cumulative Performance
  const accountSummary = React.useMemo(() => {
    let totalGrossProfit = 0;
    let totalGrossLoss = 0;
    let totalBrokerageCharges = 0;
    let totalWins = 0;
    let totalLosses = 0;

    let todayGrossProfit = 0;
    let todayGrossLoss = 0;
    let todayBrokerage = 0;
    let todayWins = 0;
    let todayLosses = 0;
    let todayTradesCount = 0;

    // 1. Open positions (belong to today's active session)
    positions.forEach((p) => {
      const isOpt = Boolean(p.isOption || /\b(CE|PE)\b/i.test(p.symbol || '') || String(p.instrumentKey || '').includes('FO'));
      const buyP = Number(p.buyPrice || 0);
      const curP = Number(p.currentLTP || buyP);
      const qty = Math.max(1, Number(p.quantity || 1));
      const pnl = p.pnl !== undefined ? Number(p.pnl) : (curP - buyP) * qty;
      const chg = calculateTradeCharges(buyP, qty, isOpt, curP);
      const brok = chg.roundTripCharges;

      totalBrokerageCharges += brok;
      todayBrokerage += brok;

      if (pnl >= 0) {
        totalGrossProfit += pnl;
        todayGrossProfit += pnl;
        totalWins += 1;
        todayWins += 1;
      } else {
        totalGrossLoss += Math.abs(pnl);
        todayGrossLoss += Math.abs(pnl);
        totalLosses += 1;
        todayLosses += 1;
      }
      todayTradesCount += 1;
    });

    // 2. Closed trade history
    tradeHistory.forEach((t) => {
      const isOpt = Boolean(t.isOption || /\b(CE|PE)\b/i.test(t.symbol || '') || String(t.instrumentKey || '').includes('FO'));
      const buyP = Number(t.buyPrice || 0);
      const sellP = Number(t.sellPrice || t.currentLTP || buyP);
      const qty = Math.max(1, Number(t.quantity || 1));
      const pnl = t.realizedPnL !== undefined ? Number(t.realizedPnL) : (sellP - buyP) * qty;

      const chg =
        Number((t as any).brokerageCharges) > 0
          ? Number((t as any).brokerageCharges)
          : calculateTradeCharges(buyP, qty, isOpt, sellP).roundTripCharges;
      totalBrokerageCharges += chg;

      if (pnl >= 0) {
        totalGrossProfit += pnl;
        totalWins += 1;
      } else {
        totalGrossLoss += Math.abs(pnl);
        totalLosses += 1;
      }

      // Check if trade was opened today in IST
      const tradeDate = (t.openedAtMs && !isNaN(Number(t.openedAtMs)))
        ? new Date(Number(t.openedAtMs)).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        : (t.openedAt && !isNaN(new Date(t.openedAt).getTime()))
          ? new Date(t.openedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
          : t.closeTime 
            ? new Date(t.closeTime).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) 
            : todayIst;

      if (tradeDate === todayIst) {
        todayTradesCount += 1;
        todayBrokerage += chg;
        if (pnl >= 0) {
          todayGrossProfit += pnl;
          todayWins += 1;
        } else {
          todayGrossLoss += Math.abs(pnl);
          todayLosses += 1;
        }
      }
    });

    const netPnLAfterCharges = totalGrossProfit - totalGrossLoss - totalBrokerageCharges;
    const todayNetPnL = todayGrossProfit - todayGrossLoss - todayBrokerage;
    const todayWinRate = todayTradesCount > 0 ? Math.round((todayWins / todayTradesCount) * 100) : 100;
    const totalTradesCount = positions.length + tradeHistory.length;
    const allTimeWinRate = totalTradesCount > 0 ? Math.round((totalWins / totalTradesCount) * 100) : 100;

    return {
      totalGrossProfit,
      totalGrossLoss,
      totalBrokerageCharges,
      netPnLAfterCharges,
      totalWins,
      totalLosses,
      allTimeWinRate,
      totalTradesCount,
      today: {
        todayGrossProfit,
        todayGrossLoss,
        todayBrokerage,
        todayNetPnL,
        todayWins,
        todayLosses,
        todayWinRate,
        todayTradesCount,
      },
    };
  }, [positions, tradeHistory, todayIst]);

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden">
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
              <div className={`px-2 py-0.5 rounded-lg border font-mono text-[10px] font-black ${
                totalPnL >= 0 
                  ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
                  : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
              }`}>
                <span>{totalPnL >= 0 ? `+₹${totalPnL.toFixed(1)}` : `-₹${Math.abs(totalPnL).toFixed(1)}`}</span>
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
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'POSITIONS' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
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
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'HOLDINGS' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
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
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'ORDERS' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
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
              <span>{language === 'ml' ? 'പൂർത്തിയായ ട്രേഡുകൾ (വാങ്ങലും വിൽക്കലും)' : 'Trade History (Paired)'}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'TRADE_HISTORY' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {tradeHistory.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Total PnL Banner & Panic Square Off */}
      {positions.length > 0 && (
        <div className="hidden sm:flex items-center justify-end gap-2 pb-2">
          <div className={`px-3 py-1 rounded-xl border font-mono-num text-xs font-black ${
            totalPnL >= 0 
              ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
              : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
          }`}>
            <span className="text-slate-400 text-[10px] mr-1">TOTAL P&L:</span>
            <span>{totalPnL >= 0 ? `+₹${totalPnL.toFixed(2)}` : `-₹${Math.abs(totalPnL).toFixed(2)}`}</span>
          </div>

          <button
            onClick={onSquareOffAll}
            className="px-3 py-1 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-black transition flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>{t.squareOffAll}</span>
          </button>
        </div>
      )}

      {/* Live Chart Navigation Quick Banner */}
      <div className="mx-3 sm:mx-4 mt-2 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-950/70 via-slate-900/80 to-cyan-950/60 border border-indigo-500/30 flex items-center justify-between gap-2 text-xs flex-wrap shadow-sm">
        <div className="flex items-center gap-2 text-indigo-200 min-w-0">
          <BarChart2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-[11px] leading-tight">
            {language === 'ml'
              ? '💡 ട്രേഡ് ചാർട്ട് കാണാൻ: ഓരോ കാർഡിലുമുള്ള "📈 ലൈവ് ചാർട്ട്" ബട്ടൺ അമർത്തുക (എൻട്രി, SL, ടാർഗറ്റ് ലൈനുകളോടെ).'
              : '💡 To view chart: Click "📈 Live Chart" on any card (with Entry, SL & Target lines).'}
          </span>
        </div>
        {onViewChart && (
          <button
            type="button"
            onClick={() => {
              if (positions.length > 0) {
                const first = positions[0];
                onViewChart(first.symbol, first.instrumentKey, {
                  symbol: first.symbol,
                  buyPrice: first.buyPrice,
                  currentLTP: first.currentLTP,
                  target: first.target,
                  stopLoss: first.stopLoss,
                  pnl: first.pnl,
                  isOption: first.isOption !== false,
                });
              } else if (tradeHistory.length > 0) {
                const first = tradeHistory[0];
                onViewChart(first.symbol, first.instrumentKey, {
                  symbol: first.symbol,
                  buyPrice: first.buyPrice,
                  sellPrice: first.sellPrice || first.currentLTP,
                  currentLTP: first.currentLTP,
                  pnl: first.realizedPnL,
                  isOption: first.isOption !== false,
                });
              } else {
                onViewChart('NIFTY', 'NSE_INDEX|Nifty 50');
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-indigo-600/40 hover:bg-indigo-600 text-cyan-200 hover:text-white border border-indigo-500/40 text-[11px] font-extrabold transition flex items-center gap-1 active:scale-95 shadow-sm shrink-0"
          >
            <span>{language === 'ml' ? '📊 ഫുൾ ചാർട്ട് സ്ക്രീൻ' : '📊 Full Chart'}</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto smooth-scroll p-3 sm:p-4 pb-20 sm:pb-6">
        
        {/* POSITIONS TAB */}
        {activeTab === 'POSITIONS' && (
          <div className="space-y-3">
            {/* DUAL SUMMARY: 1. Today's Trading Performance & 2. Total All-Time Cumulative Performance */}
            <div className="space-y-2.5">
              {/* Row 1: Today's Trading Performance */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/25 via-slate-900/90 to-slate-900 border border-emerald-900/50 shadow-md">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-900/30">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[11px] font-black uppercase tracking-wide text-emerald-300">
                      {language === 'ml' ? '📅 ഇന്നത്തെ ട്രേഡിംഗ് സംഗ്രഹം (Today: ' + todayIst + ')' : "📅 Today's Trading Summary (" + todayIst + ')'}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-900/50 text-emerald-200 font-bold">
                      {accountSummary.today.todayTradesCount} {language === 'ml' ? 'ട്രേഡുകൾ' : 'Trades'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-300">
                    <span className="text-slate-400 text-[10px] mr-1">{language === 'ml' ? 'വിജയം:' : 'Win Rate:'}</span>
                    <span className="text-emerald-400 font-black">{accountSummary.today.todayWinRate}%</span>
                    <span className="text-slate-500 text-[10px] ml-1">({accountSummary.today.todayWins}W / {accountSummary.today.todayLosses}L)</span>
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
                  <div className={`p-2.5 rounded-xl border ${
                    accountSummary.today.todayNetPnL >= 0
                      ? 'bg-emerald-950/40 border-emerald-500/50'
                      : 'bg-rose-950/40 border-rose-500/50'
                  }`}>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-cyan-300 block">
                      {language === 'ml' ? 'ഇന്നത്തെ അറ്റ ലാഭം (Net P&L)' : 'Today Net P&L'}
                    </span>
                    <span className={`text-sm sm:text-base font-black font-mono mt-0.5 block ${
                      accountSummary.today.todayNetPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {accountSummary.today.todayNetPnL >= 0 ? '+' : '-'}₹{Math.abs(accountSummary.today.todayNetPnL).toFixed(2)}
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
                      {language === 'ml' ? '🌐 ആകെ മൊത്തം ട്രേഡിംഗ് ഹിസ്റ്ററി (All-Time)' : '🌐 Total Cumulative Performance (All-Time)'}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-900/50 text-indigo-200 font-bold">
                      {accountSummary.totalTradesCount} {language === 'ml' ? 'ആകെ ട്രേഡുകൾ' : 'Total Trades'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-300">
                    <span className="text-slate-400 text-[10px] mr-1">{language === 'ml' ? 'ആകെ വിൻ റേറ്റ്:' : 'Overall Win Rate:'}</span>
                    <span className="text-cyan-300 font-black">{accountSummary.allTimeWinRate}%</span>
                    <span className="text-slate-500 text-[10px] ml-1">({accountSummary.totalWins}W / {accountSummary.totalLosses}L)</span>
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
                  <div className={`p-2.5 rounded-xl border ${
                    accountSummary.netPnLAfterCharges >= 0
                      ? 'bg-indigo-950/40 border-indigo-500/50'
                      : 'bg-rose-950/40 border-rose-500/50'
                  }`}>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-cyan-300 block">
                      {language === 'ml' ? 'ആകെ അറ്റ ലാഭം (Total Net P&L)' : 'Total Net P&L'}
                    </span>
                    <span className={`text-sm sm:text-base font-black font-mono mt-0.5 block ${
                      accountSummary.netPnLAfterCharges >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {accountSummary.netPnLAfterCharges >= 0 ? '+' : '-'}₹{Math.abs(accountSummary.netPnLAfterCharges).toFixed(2)}
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
                    ({positions.filter(p => p.isOption || p.symbol.includes('CE') || p.symbol.includes('PE')).length})
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
                    ({positions.filter(p => !p.isOption && !p.symbol.includes('CE') && !p.symbol.includes('PE')).length})
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
                  {language === 'ml' ? 'നിലവിൽ തിരഞ്ഞെടുത്ത വിഭാഗത്തിൽ പൊസിഷനുകൾ ഒന്നുമില്ല.' : 'No active positions in this category.'}
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  {language === 'ml' ? 'അൽഗോരിതം ലൈവായി അടുത്ത അവസരങ്ങൾ നിരീക്ഷിക്കുന്നു.' : 'The algo engine is continuously scanning for high-probability setups.'}
                </p>
              </div>
            ) : (
              filteredPositions.map((pos) => (
                <PositionItem 
                  key={pos.id + "-" + pos.productType} 
                  pos={pos} 
                  onSquareOff={onSquareOffPosition} 
                  isNew={newlyAddedIds.has(pos.id)}
                  onViewChart={onViewChart}
                  language={language}
                />
              ))
            )}
          </div>
        )}

        {/* HOLDINGS TAB */}
        {activeTab === 'HOLDINGS' && (
          <div className="space-y-4">
            {/* Holdings Summary Portfolio Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  {language === 'ml' ? 'ഹോൾഡിങ്സ് പോർട്ട്ഫോളിയോ മൂല്യം' : 'Total Holdings Value'}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                    ₹{totalHoldingsValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-xs font-bold font-mono ${totalHoldingsPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totalHoldingsPnL >= 0 ? '+' : ''}₹{totalHoldingsPnL.toFixed(2)} ({totalHoldingsPnLPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">{language === 'ml' ? 'നിക്ഷേപിച്ചത്' : 'Invested'}</span>
                  <span className="text-sm font-bold font-mono text-slate-200">₹{totalHoldingsInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">{language === 'ml' ? 'ആകെ ഓഹരികൾ' : 'Total Scrips'}</span>
                  <span className="text-sm font-bold font-mono text-cyan-400">{holdings.length} Stocks</span>
                </div>
                {onRefreshHoldings && (
                  <button
                    onClick={onRefreshHoldings}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95 flex items-center gap-1.5 text-xs font-bold shadow-sm"
                    title={language === 'ml' ? 'Upstox പോർട്ട്ഫോളിയോ വീണ്ടും സിങ്ക് ചെയ്യുക' : 'Re-sync Upstox Holdings'}
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">{language === 'ml' ? 'പോർട്ട്ഫോളിയോ സിങ്ക്' : 'Sync Holdings'}</span>
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
                        : 'Please activate today\'s Upstox Access Token to load your Demat Holdings.'
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
                    <span>🔑 {language === 'ml' ? 'Upstox ടോക്കൺ കണക്റ്റ് ചെയ്യുക' : 'Connect Upstox Token'}</span>
                  </button>
                )}

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-left text-xs max-w-lg mx-auto space-y-2">
                  <p className="text-amber-400 font-bold flex items-center gap-1.5">
                    <span>💡</span>
                    <span>{language === 'ml' ? 'ശ്രദ്ധിക്കുക (Important Notes):' : 'Why are my holdings not showing?'}</span>
                  </p>
                  <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px]">
                    <li>
                      <strong>{language === 'ml' ? 'Upstox ടോക്കൺ സ്റ്റാറ്റസ്:' : 'Upstox Token Status:'}</strong>{' '}
                      {language === 'ml'
                        ? 'API Key & Secret മാത്രം സേവ് ചെയ്താൽ ഹോൾഡിങ്‌സ് വരില്ല; ഇന്നത്തെ Access Token ജനറേറ്റ് ചെയ്ത് "🟢 Upstox ലൈവ് കണക്റ്റഡ്" ആണെന്ന് ഉറപ്പാക്കുക.'
                        : 'Saving API Key & Secret alone is not enough; generate today\'s Access Token so status turns Green.'}
                    </li>
                    <li>
                      <strong>{language === 'ml' ? 'ഇൻട്രാഡേ & ഓപ്ഷൻ ട്രേഡുകൾ:' : 'Intraday & Option Positions:'}</strong>{' '}
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
                  const pnlPercent = avgPx > 0 ? Number((((curLtp - avgPx) / avgPx) * 100).toFixed(2)) : 0;
                  const isGain = pnl >= 0;

                  const target50 = h.fiftyPercentTarget || {
                    targetPrice: Number((avgPx * 1.5).toFixed(2)),
                    targetTotalValue: Number((avgPx * 1.5 * qty).toFixed(2)),
                    targetProfitAmount: Number((avgPx * 0.5 * qty).toFixed(2)),
                    priceNeeded: Number(Math.max(0, avgPx * 1.5 - curLtp).toFixed(2)),
                    profitRemaining: Number(Math.max(0, avgPx * 0.5 * qty - pnl).toFixed(2)),
                    progressPct: avgPx > 0 ? Number(Math.max(0, Math.min(100, ((curLtp - avgPx) / (avgPx * 0.5)) * 100)).toFixed(1)) : 0,
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
                                ⚠️ {language === 'ml' ? 'ബ്രോക്കർ വില ലഭ്യമല്ല (ക്ലോസിങ് വില)' : 'Zero broker price (Using close)'}
                              </span>
                            )}
                            {target50.isReached ? (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-amber-500/25 text-amber-200 border border-amber-400/60 animate-pulse">
                                ⚡ +50% PROFIT TARGET HIT!
                              </span>
                            ) : isGain && pnl > 0 ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                🟢 IN PROFIT (ലാഭത്തിൽ)
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{h.companyName || `${h.symbol} Ltd`}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold font-mono text-white">₹{curLtp.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">LTP</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-center font-mono">
                        <div>
                          <span className="text-[9px] text-slate-400 block">{language === 'ml' ? 'അളവ് (Qty)' : 'Qty'}</span>
                          <span className="text-xs font-bold text-slate-200">{qty}</span>
                        </div>
                        <div className="relative group">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[9px] text-slate-400 block">{language === 'ml' ? 'വാങ്ങിയ വില (Avg)' : 'Avg Buy Price'}</span>
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
                              title={language === 'ml' ? 'വാങ്ങിയ യഥാർത്ഥ വില എഡിറ്റ് ചെയ്ത് ലോക്ക് ചെയ്യുക' : 'Edit & lock actual buy price'}
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
                          <span className="text-[9px] text-slate-400 block">{language === 'ml' ? 'നിക്ഷേപം (Invested)' : 'Invested'}</span>
                          <span className="text-xs font-bold text-slate-300">₹{invested.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block">{language === 'ml' ? 'ലാഭം / നഷ്ടം' : 'Exact P&L'}</span>
                          <span className={`text-xs font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isGain ? '+' : ''}₹{pnl.toFixed(2)}
                            <span className="block text-[9px]">({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
                          </span>
                        </div>
                      </div>

                      {/* Interactive Custom Buy Price Editor */}
                      {editingHoldingSym === h.symbol && (
                        <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5" />
                              {language === 'ml' ? `${h.symbol} വാങ്ങിയ യഥാർത്ഥ വില നിശ്ചയിക്കുക:` : `Set Exact Buy Price for ${h.symbol}:`}
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
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                              <input
                                type="number"
                                step="0.05"
                                min="0.05"
                                value={customBuyPriceInput}
                                onChange={(e) => setCustomBuyPriceInput(e.target.value)}
                                placeholder={avgPx > 0 ? String(avgPx) : "10.50"}
                                className="w-full pl-6 pr-3 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/50 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={savingBuyPrice || !customBuyPriceInput || parseFloat(customBuyPriceInput) <= 0}
                              onClick={() => handleSaveCustomBuyPrice(h.symbol, h.isin)}
                              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shadow-sm"
                            >
                              {savingBuyPrice ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              <span>{language === 'ml' ? 'സ്ഥിരപ്പെടുത്തുക' : 'Save & Lock'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* +50% Profitable Value Milestone Calculation Box */}
                      <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-[11px] flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-amber-300 flex items-center gap-1">
                            🎯 {language === 'ml' ? 'വാങ്ങിയ വിലയുടെ +50% ലാഭ കണക്കുകൂട്ടൽ:' : '+50% Buy-Price Profit Milestone:'}
                          </span>
                          <span className="font-mono text-[10px] font-black text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/40">
                            {target50.isReached
                              ? '⚡ +50% ലക്ഷ്യം കൈവരിച്ചു!'
                              : `${target50.progressPct}% Complete`}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono pt-1 border-t border-amber-500/20">
                          <div>
                            <span className="text-slate-400 block">{language === 'ml' ? '+50% ടാർഗറ്റ് വില:' : '+50% Target LTP:'}</span>
                            <strong className="text-amber-300">₹{target50.targetPrice.toFixed(2)}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">{language === 'ml' ? '+50% ആകുമ്പോൾ ലാഭം:' : 'Profit at +50%:'}</span>
                            <strong className="text-emerald-300">+₹{target50.targetProfitAmount.toFixed(2)}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">{language === 'ml' ? 'ഇനി വേണ്ട വില കയറ്റം:' : 'LTP Rise Needed:'}</span>
                            <strong className="text-cyan-300">
                              {target50.isReached ? '₹0.00 (Hit!)' : `+₹${target50.priceNeeded.toFixed(2)}/sh`}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">{language === 'ml' ? '+50% മൂല്യം (Total):' : 'Value at +50%:'}</span>
                            <strong className="text-white">₹{target50.targetTotalValue.toFixed(2)}</strong>
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
                        <div className={`p-2.5 rounded-lg border text-[11px] flex flex-col gap-1.5 ${
                          forecast.direction === 'STRONG_UPTREND' || forecast.direction === 'UPTREND'
                            ? 'bg-emerald-950/25 border-emerald-500/35 text-emerald-200'
                            : forecast.direction === 'DOWNTREND_RISK'
                              ? 'bg-rose-950/25 border-rose-500/35 text-rose-200'
                              : 'bg-cyan-950/25 border-cyan-500/35 text-cyan-200'
                        }`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-extrabold flex items-center gap-1.5 text-xs">
                              🧠 {language === 'ml' ? 'അൽഗോരിതം മുൻകൂട്ടി കാണുന്ന പ്രവചനം (Algo Forecast):' : 'Pre-Cognitive Algo Forecast:'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-[10px] font-bold">
                              Confidence: {forecast.confidencePct}% | +50% Hit Prob: {forecast.fiftyPctReachProbability}%
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed font-medium text-slate-200">
                            {forecast.forecastSummaryMl}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/10 text-[10px] font-mono text-slate-300">
                            <div>
                              <span className="text-slate-400 block">30D Algo Target:</span>
                              <strong className="text-emerald-300">₹{forecast.expectedTarget30d.toFixed(2)}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Support / Resist:</span>
                              <strong className="text-cyan-300">₹{forecast.supportLevel} / ₹{forecast.resistanceLevel}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">20D / 50D EMA:</span>
                              <strong className="text-slate-200">₹{forecast.ema20} / ₹{forecast.ema50}</strong>
                            </div>
                            <div>
                              <span className="text-slate-400 block">14D RSI & Action:</span>
                              <strong className="text-amber-300">RSI {forecast.rsi14} · {forecast.recommendedAction.replace(/_/g, ' ')}</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                        <div className="text-[11px] text-slate-400">
                          <span>{language === 'ml' ? 'നിലവിലെ മൂല്യം' : 'Cur Value'}: </span>
                          <strong className="text-slate-200 font-mono">₹{currentVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {onViewChart && (
                            <button
                              type="button"
                              onClick={() => onViewChart(h.symbol, (h as any).instrumentKey || `NSE_EQ|${h.symbol}`, {
                                symbol: h.symbol,
                                buyPrice: avgPx,
                                currentLTP: curLtp,
                                pnl: pnl,
                                isOption: false
                              })}
                              className="px-3 py-1.5 min-h-[36px] rounded-xl bg-gradient-to-r from-indigo-600/35 to-cyan-600/35 hover:from-indigo-600 hover:to-cyan-600 text-cyan-200 hover:text-white border border-cyan-500/40 text-xs font-black transition flex items-center gap-1.5 active:scale-95 touch-manipulation shadow-sm"
                              title={language === 'ml' ? 'ഈ ഓഹരിയുടെ ലൈവ് ചാർട്ട് കാണുക' : 'View Live Stock Chart'}
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
                                onClick={() =>
                                  onOpenOrderModal('SELL', h.symbol, h.currentLTP || 0, {
                                    quantity: h.quantity || 1,
                                    heldQuantity: h.quantity,
                                    productType: 'DELIVERY',
                                    instrumentKey: (h as any).instrumentKey,
                                  })
                                }
                                className="px-2.5 py-1 min-h-[36px] rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition flex items-center gap-1 active:scale-95 touch-manipulation"
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
        )}

        {/* ORDERS TAB */}
        {activeTab === 'ORDERS' && (
          <div className="space-y-3">
            {/* ORDERS VIEW MODE TOGGLE & EXPLANATION BANNER */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>{language === 'ml' ? 'ബ്രോക്കർ ഓർഡർ ബുക്ക് & റൗണ്ട്-ട്രിപ്പ്' : 'Broker Order Book & Round-Trips'}</span>
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
                    {language === 'ml' ? 'പൂർത്തിയായ റൗണ്ട്-ട്രിപ്പ് ട്രേഡുകൾ ഒന്നുമില്ല.' : 'No completed round-trip trades recorded.'}
                  </p>
                </div>
              ) : (
                tradeHistory.map((pos) => {
                  const gross = (pos.realizedPnL || 0);
                  const isOpt = Boolean(pos.isOption || /\b(CE|PE)\b/i.test(pos.symbol || '') || String(pos.instrumentKey || '').includes('FO'));
                  const estCharges =
                    Number((pos as any).brokerageCharges) > 0
                      ? Number((pos as any).brokerageCharges)
                      : calculateTradeCharges(
                          Number(pos.buyPrice || 0),
                          Math.max(1, Number(pos.quantity || 1)),
                          isOpt,
                          Number(pos.sellPrice || pos.currentLTP || pos.buyPrice || 0)
                        ).roundTripCharges;
                  const net = gross - estCharges;

                  const entryDt = formatTradeDateTime(pos.openedAtMs || pos.openedAt, language);
                  const exitDt = formatTradeDateTime(pos.closeTime, language);
                  const tradeDateLabel = entryDt.dateStr || exitDt.dateStr || (pos.closeTime ? new Date(pos.closeTime).toLocaleDateString('en-IN') : 'Trade Session');
                  const duration = getTradeDuration(pos.openedAtMs || pos.openedAt, pos.closeTime, language);
                  const exitReason = translateExitReason(pos.exitReason, language, net, gross);

                  const buyPx = Number(pos.buyPrice || 0);
                  const sellPx = Number(pos.sellPrice || pos.currentLTP || buyPx);
                  const qty = Math.max(1, Number(pos.quantity || 1));
                  const investedValue = buyPx * qty;
                  const returnedValue = sellPx * qty;

                  return (
                    <div 
                      key={`paired_${pos.id}`} 
                      className="bg-gradient-to-br from-[#0c1222]/80 via-[#080c16]/95 to-[#111827]/80 backdrop-blur-md p-4 rounded-2xl border border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:border-slate-700/80 transition-all duration-500 relative overflow-hidden flex flex-col gap-3 group"
                    >
                      {/* Top Glowing Accent Line */}
                      <div className={`h-[2px] w-full absolute top-0 left-0 ${net >= 0 ? 'bg-gradient-to-r from-emerald-500/60 via-cyan-400/40 to-transparent' : 'bg-gradient-to-r from-rose-500/60 via-amber-400/40 to-transparent'}`} />

                      {/* Header Row: Symbol, Date, Chart Action, and Net P&L */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800/60">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-black text-white text-base tracking-tight">{pos.symbol}</span>
                          <span className="text-[11px] text-slate-300 bg-slate-800/70 px-2 py-0.5 rounded-md border border-slate-700/50 font-mono">
                            Qty: <strong className="text-white">{qty}</strong>
                          </span>
                          <div className="flex items-center gap-1 text-slate-400 text-xs font-sans">
                            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{tradeDateLabel}</span>
                          </div>
                          {duration && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({duration})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {onViewChart && (
                            <button
                              type="button"
                              onClick={() => onViewChart(pos.symbol, pos.instrumentKey, {
                                symbol: pos.symbol,
                                buyPrice: buyPx,
                                sellPrice: sellPx,
                                currentLTP: sellPx,
                                pnl: net,
                                isOption: /\b(CE|PE)\b/i.test(pos.symbol)
                              })}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-cyan-300 hover:text-white text-xs font-bold border border-indigo-500/30 transition flex items-center gap-1 active:scale-95"
                              title={language === 'ml' ? 'ഈ ട്രേഡിന്റെ ലൈവ് ചാർട്ട് കാണുക' : 'View Live Candlestick Chart for this trade'}
                            >
                              <BarChart2 className="w-3.5 h-3.5 text-cyan-300" />
                              <span>{language === 'ml' ? 'ലൈവ് ചാർട്ട്' : 'Live Chart'}</span>
                            </button>
                          )}
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-mono block">Net P&L</span>
                            <span className={`text-base sm:text-lg font-black font-mono tracking-tight ${
                              net >= 0 
                                ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' 
                                : 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                            }`}>
                              {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Execution Details: Seamless Horizontal Flow (Light lines, no rigid box clutter) */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono pt-1">
                        <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">BUY</span>
                            <span className="text-white font-bold text-sm">₹{buyPx.toFixed(2)}</span>
                            <span className="text-slate-400 text-[11px] font-sans">({entryDt.timeStr || pos.openedAt || '—'})</span>
                          </div>

                          <span className="text-slate-600 font-bold hidden sm:inline">→</span>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-black text-rose-400 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">SELL</span>
                            <span className="text-white font-bold text-sm">₹{sellPx.toFixed(2)}</span>
                            <span className="text-slate-400 text-[11px] font-sans">({exitDt.timeStr || (pos.closeTime ? new Date(pos.closeTime).toLocaleTimeString('en-IN') : '—')})</span>
                          </div>
                        </div>

                        {/* Financial charges & Exit reason */}
                        <div className="flex items-center gap-2.5 flex-wrap justify-between sm:justify-end">
                          <span className="text-[11px] text-slate-400 font-sans">
                            Gross: <strong className="text-slate-200">₹{gross.toFixed(2)}</strong> • Charges: <strong className="text-slate-300">₹{estCharges.toFixed(2)}</strong>
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            net >= 0
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          }`}>
                            {exitReason}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              /* INDIVIDUAL ORDERS VIEW */
              orders.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                  <p className="text-xs font-semibold">
                    {language === 'ml' ? 'ഇതുവരെ ഓർഡറുകൾ ഒന്നും നൽകിയിട്ടില്ല (മാർക്കറ്റ് സമയം 09:18 AM മുതൽ അൽഗോരിതം ട്രേഡ് എടുക്കും).' : 'No orders recorded in this session (Algo takes entries after 09:18 AM IST).'}
                  </p>
                </div>
              ) : (
                orders.map((ord) => {
                  const isNew = newlyAddedIds.has(ord.id);
                  const isBuy = ord.transactionType === 'BUY';
                  const execPx = Number(ord.executedPrice || ord.price || 0);
                  const qty = Math.max(1, Number(ord.quantity || 1));
                  const isOpt = /\b(CE|PE)\b/i.test(ord.symbol || '') || String(ord.instrumentKey || '').includes('FO');
                  const matchingOpenPos = positions.find(
                    p => ((ord as any).positionId && p.id === (ord as any).positionId) || p.symbol === ord.symbol
                  );
                  const matchingClosedTrade = tradeHistory.find(t => {
                    if ((ord as any).positionId && t.id === (ord as any).positionId) return true;
                    if (t.symbol !== ord.symbol) return false;
                    if (isBuy && Math.abs(Number(t.buyPrice || 0) - execPx) < 0.05) return true;
                    if (!isBuy && Math.abs(Number(t.sellPrice || 0) - execPx) < 0.05) return true;
                    return false;
                  }) || tradeHistory.find(t => t.symbol === ord.symbol);

                  const entryPx = Number(
                    (ord as any).buyPrice ||
                      matchingOpenPos?.buyPrice ||
                      matchingClosedTrade?.buyPrice ||
                      execPx
                  );
                  const currentOrExitPx = matchingOpenPos
                    ? Number(matchingOpenPos.currentLTP || execPx)
                    : Number(
                        (ord as any).sellPrice ||
                          matchingClosedTrade?.sellPrice ||
                          matchingClosedTrade?.currentLTP ||
                          execPx
                      );
                  const ordCharges = calculateTradeCharges(entryPx, qty, isOpt, currentOrExitPx);
                  const roundTripTax = Number((ord as any).brokerageCharges || ordCharges.roundTripCharges);
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

                  const orderFormattedDate = formatTradeDateTime((ord as any).time || ord.timestamp, language);

                  return (
                    <div
                      key={ord.id}
                      className={`p-4 rounded-2xl border transition-all duration-500 backdrop-blur-md shadow-[0_4px_20px_rgb(0,0,0,0.3)] relative overflow-hidden ${
                        isNew
                          ? (isBuy ? 'animate-trade-glow-buy' : 'animate-trade-glow-sell')
                          : 'bg-gradient-to-br from-[#0c1222]/80 to-[#080c16]/95 border-slate-800/80 hover:bg-[#0c1222]/90 hover:border-slate-700/60 animate-row-enter'
                      }`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-tr ${isBuy ? 'from-emerald-500/5' : 'from-rose-500/5'} to-transparent pointer-events-none opacity-40`} />
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black w-14 text-center shrink-0 tracking-wider ${
                            isBuy
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}>
                            {isBuy ? (language === 'ml' ? 'വാങ്ങൽ' : 'BUY') : (language === 'ml' ? 'വിൽക്കൽ' : 'SELL')}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-white font-sans text-sm tracking-tight truncate">{ord.symbol}</span>
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
                              <span className="text-slate-300 text-[10px] font-mono">Qty: <strong className="text-white">{qty}</strong></span>
                              {ord.productType && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                                  <span className="text-slate-400 text-[10px] font-sans">{ord.productType}</span>
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
                                onClick={() => onViewChart(ord.symbol, ord.instrumentKey, {
                                  symbol: ord.symbol,
                                  buyPrice: entryPx,
                                  currentLTP: currentOrExitPx,
                                  pnl: grossPnl,
                                  isOption: isOpt
                                })}
                                className="px-2 py-0.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-cyan-300 hover:text-white text-[10px] font-bold border border-indigo-500/30 transition flex items-center gap-1 active:scale-95"
                                title={language === 'ml' ? 'ഈ ഓർഡറിന്റെ ലൈവ് ചാർട്ട് കാണുക' : 'View Live Candlestick Chart'}
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
                            {language === 'ml' ? 'മൂല്യം:' : 'Val:'} <strong className="text-slate-200">₹{(execPx * qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                          </span>
                          <span>
                            {language === 'ml' ? 'ചാർജ്ജുകൾ:' : 'Chg:'} <strong className="text-amber-300">₹{(matchingClosedTrade ? roundTripTax : (roundTripTax / 2)).toFixed(2)}</strong>
                          </span>
                        </div>
                        <div>
                          {matchingOpenPos ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              {language === 'ml' ? 'ഹോൾഡ് ചെയ്യുന്നു' : 'Holding Active'}
                            </span>
                          ) : matchingClosedTrade ? (
                            <span className="text-[11px]">
                              Net: <strong className={`font-black ${netPnlAfterTax >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{netPnlAfterTax >= 0 ? '+' : ''}₹{netPnlAfterTax.toFixed(2)}</strong>
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
              )
            )}
          </div>
        )}

      
        {/* TRADE HISTORY TAB */}
        {activeTab === 'TRADE_HISTORY' && (
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
                      {language === 'ml' ? 'പൂർത്തിയായ ട്രേഡുകൾ — വാങ്ങലും വിൽക്കലും ഒരുമിച്ച്' : 'Completed Trades — Buy & Sell Combined'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {language === 'ml' ? `ആകെ ${tradeHistory.length} ട്രേഡുകൾ` : `${tradeHistory.length} Total Trades`}
                    </span>
                    {onSyncHistoryBrokerage && (
                      <button
                        onClick={onSyncHistoryBrokerage}
                        className="ml-auto px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                        title={language === 'ml' ? 'Upstox API-യുമായി ലാഭം ഒത്തുനോക്കുക' : 'Sync Brokerage with Upstox API'}
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
                    <span>{language === 'ml' ? `എല്ലാ തീയതികളും (${tradeHistory.length})` : `All Dates (${tradeHistory.length})`}</span>
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
                    ? (language === 'ml' ? 'പൂർത്തിയാക്കിയ ട്രേഡുകൾ ഒന്നും ലഭ്യമല്ല.' : 'No completed trades available.')
                    : (language === 'ml' ? 'തിരഞ്ഞെടുത്ത തീയതിയിൽ ട്രേഡുകൾ ഒന്നുമില്ല.' : 'No completed trades for selected date.')}
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
              filteredTradeHistory.map((pos) => {
                const gross = (pos.realizedPnL || 0);
                const isOpt = Boolean(pos.isOption || /\b(CE|PE)\b/i.test(pos.symbol || '') || String(pos.instrumentKey || '').includes('FO'));
                const estCharges =
                  Number((pos as any).brokerageCharges) > 0
                    ? Number((pos as any).brokerageCharges)
                    : calculateTradeCharges(
                        Number(pos.buyPrice || 0),
                        Math.max(1, Number(pos.quantity || 1)),
                        isOpt,
                        Number(pos.sellPrice || pos.currentLTP || pos.buyPrice || 0)
                      ).roundTripCharges;
                const net = gross - estCharges;

                const entryDt = formatTradeDateTime(pos.openedAtMs || pos.openedAt, language);
                const exitDt = formatTradeDateTime(pos.closeTime, language);
                const tradeDateLabel = entryDt.dateStr || exitDt.dateStr || (pos.closeTime ? new Date(pos.closeTime).toLocaleDateString('en-IN') : 'Trade Session');
                const duration = getTradeDuration(pos.openedAtMs || pos.openedAt, pos.closeTime, language);
                const exitReason = translateExitReason(pos.exitReason, language, net, gross);

                const buyPx = Number(pos.buyPrice || 0);
                const sellPx = Number(pos.sellPrice || pos.currentLTP || buyPx);
                const qty = Math.max(1, Number(pos.quantity || 1));
                const investedValue = buyPx * qty;
                const returnedValue = sellPx * qty;
                const peakPrice = Number(pos.highestLTP || Math.max(buyPx, sellPx));
                const peakProfit = pos.highestPnl !== undefined ? Number(pos.highestPnl) : Math.max(0, (peakPrice - buyPx) * qty);
                
                return (
                <div key={pos.id} className="bg-gradient-to-br from-[#0c1222] via-[#090d18] to-slate-900/90 p-4 rounded-2xl border border-slate-800/90 flex flex-col gap-3.5 relative overflow-hidden shadow-lg transition-all duration-300 hover:border-slate-700">
                  <div className={`absolute top-0 right-0 w-44 h-44 rounded-full blur-3xl opacity-15 pointer-events-none ${net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  
                  {/* Top Header: Round-Trip Completed Badge, Trade Date, Duration & Chart */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 z-10 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 uppercase tracking-wider shadow-sm">
                        <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                        {language === 'ml' ? 'വാങ്ങലും വിൽക്കലും പൂർത്തിയായി' : 'Completed Round-Trip'}
                      </span>
                      <span className="font-black text-white text-base font-sans tracking-tight">
                        {pos.symbol}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {pos.productType || 'INTRADAY'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                      {/* Trade Date Badge */}
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-950/70 border border-indigo-500/40 text-cyan-200 text-xs font-bold shadow-sm font-sans" title="Trade Session Date">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{tradeDateLabel}</span>
                      </div>

                      {/* Trade Duration Badge */}
                      {duration && (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-bold" title="Trade Duration">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{duration}</span>
                        </div>
                      )}

                      {/* Chart Button */}
                      {onViewChart && (
                        <button
                          type="button"
                          onClick={() => onViewChart(pos.symbol, pos.instrumentKey, {
                            symbol: pos.symbol,
                            buyPrice: pos.buyPrice,
                            sellPrice: pos.sellPrice || pos.currentLTP,
                            currentLTP: pos.currentLTP,
                            target: pos.target,
                            stopLoss: pos.stopLoss,
                            pnl: pos.realizedPnL,
                            isOption: isOpt
                          })}
                          className="px-3 py-1.5 min-h-[34px] rounded-xl bg-gradient-to-r from-indigo-600/35 to-cyan-600/35 hover:from-indigo-600 hover:to-cyan-600 text-cyan-200 hover:text-white text-xs font-black border border-cyan-500/40 transition shadow-sm flex items-center gap-1.5 active:scale-95 touch-manipulation"
                          title={language === 'ml' ? 'ഈ ട്രേഡിന്റെ കാൻഡിൽസ്റ്റിക്ക് ചാർട്ട് കാണുക' : 'View Candlestick Chart for this trade'}
                        >
                          <BarChart2 className="w-3.5 h-3.5 text-cyan-300" />
                          <span>{language === 'ml' ? '📈 ലൈവ് ചാർട്ട്' : '📈 Live Chart'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Two Side-by-Side Panels: Entry/Buy on Left & Exit/Sell on Right (വാങ്ങിയതും വിറ്റതും ഒന്നിച്ച്) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 z-10">
                    {/* 1. ENTRY / BUY SIDE (വാങ്ങിയത്) */}
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span className="text-xs font-black text-emerald-300 uppercase tracking-wide">
                            {language === 'ml' ? '1. വാങ്ങിയത് (ENTRY / BUY)' : '1. Bought (Entry)'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                          {qty} Qty
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {language === 'ml' ? 'വാങ്ങിയ തീയതി & സമയം' : 'Buy Date & Time'}
                          </span>
                          <span className="text-slate-200 font-bold text-[11px] block mt-0.5">
                            {entryDt.fullStr || entryDt.timeStr || pos.openedAt || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {language === 'ml' ? 'വാങ്ങിയ പ്രീമിയം വില' : 'Buy Price'}
                          </span>
                          <span className="text-emerald-300 font-black text-sm block mt-0.5">
                            ₹{buyPx.toFixed(2)}
                          </span>
                        </div>
                        <div className="col-span-2 pt-1.5 border-t border-emerald-500/10 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-sans">
                            {language === 'ml' ? 'ആകെ മുതൽമുടക്ക് (Invested Value):' : 'Invested Value:'}
                          </span>
                          <span className="text-white font-bold">
                            ₹{investedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. EXIT / SELL SIDE (വിറ്റത്) */}
                    <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between border-b border-rose-500/20 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                          <span className="text-xs font-black text-rose-300 uppercase tracking-wide">
                            {language === 'ml' ? '2. വിറ്റത് (EXIT / SELL)' : '2. Sold (Exit)'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
                          {qty} Qty
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {language === 'ml' ? 'വിറ്റ തീയതി & സമയം' : 'Exit Date & Time'}
                          </span>
                          <span className="text-slate-200 font-bold text-[11px] block mt-0.5">
                            {exitDt.fullStr || exitDt.timeStr || (pos.closeTime ? new Date(pos.closeTime).toLocaleTimeString('en-IN') : '—')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {language === 'ml' ? 'വിറ്റ പ്രീമിയം വില' : 'Exit Price'}
                          </span>
                          <span className="text-rose-300 font-black text-sm block mt-0.5">
                            ₹{sellPx.toFixed(2)}
                          </span>
                        </div>
                        <div className="col-span-2 pt-1.5 border-t border-rose-500/10 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-sans">
                            {language === 'ml' ? 'തിരിച്ചുകിട്ടിയ തുക (Returned Value):' : 'Returned Value:'}
                          </span>
                          <span className="text-white font-bold">
                            ₹{returnedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Peak Price Analytics & Realized P&L Breakdown */}
                  <div className="p-3 rounded-xl bg-black/40 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono z-10">
                    {/* Peak Price in Chart & Exit Trigger */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {language === 'ml' ? 'ചാർട്ടിൽ എത്തിയ പരമാവധി വില' : 'Chart Peak High'}
                          </span>
                          <span className="text-amber-300 font-bold">
                            ₹{peakPrice.toFixed(2)}
                            {peakProfit > 0 && (
                              <span className="text-emerald-400 text-[10px] ml-1 font-sans">
                                ({language === 'ml' ? 'പരമാവധി ലാഭ സാധ്യത' : 'Peak PnL'}: +₹{Math.round(peakProfit)})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">
                          {language === 'ml' ? 'എക്സിറ്റ് കാരണം' : 'Exit Reason'}
                        </span>
                        <span className="text-cyan-300 font-bold text-[11px]">
                          {exitReason}
                        </span>
                      </div>
                    </div>

                    {/* Financial Summary: Gross P&L, Brokerage/Tax, Net Realized P&L */}
                    <div className="flex items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans uppercase">
                          {language === 'ml' ? 'മൊത്തം ലാഭം (Gross)' : 'Gross P&L'}
                        </span>
                        <span className={`font-bold ${gross >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {gross >= 0 ? '+' : ''}₹{gross.toFixed(2)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block font-sans uppercase" title="Brokerage, STT, Exchange, GST">
                          {language === 'ml' ? 'ചാർജുകൾ' : 'Charges'}
                        </span>
                        <span className="text-amber-400 font-bold">
                          -₹{estCharges.toFixed(2)}
                        </span>
                      </div>

                      <div className={`px-3 py-1.5 rounded-xl border flex flex-col items-end ${
                        net >= 0 
                          ? 'bg-emerald-950/60 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]' 
                          : 'bg-rose-950/60 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                      }`}>
                        <span className="text-[9px] uppercase font-sans font-black text-slate-300">
                          {language === 'ml' ? 'അറ്റ ലാഭം (Net P&L)' : 'Net P&L'}
                        </span>
                        <span className={`text-sm font-black font-mono ${net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )})
            )}
            
            {tradeHistory.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mt-4">
                <button
                  onClick={() => {
                    const headers = ['Symbol,Type,Quantity,Buy Price,Sell Price,Gross PnL,Net PnL,Close Time'];
                    const rows = tradeHistory.map(t => {
                      const gross = t.realizedPnL || 0;
                      const isOpt = Boolean(t.isOption || /\b(CE|PE)\b/i.test(t.symbol || '') || String(t.instrumentKey || '').includes('FO'));
                      const chg =
                        Number((t as any).brokerageCharges) > 0
                          ? Number((t as any).brokerageCharges)
                          : calculateTradeCharges(
                              Number(t.buyPrice || 0),
                              Math.max(1, Number(t.quantity || 1)),
                              isOpt,
                              Number(t.sellPrice || t.currentLTP || t.buyPrice || 0)
                            ).roundTripCharges;
                      const net = gross - chg;
                      return `"${t.symbol}","${(t as any).type || 'BUY'}",${t.quantity},${t.buyPrice || 0},${t.sellPrice || 0},${gross.toFixed(2)},${net.toFixed(2)},"${t.closeTime ? new Date(t.closeTime).toLocaleString('en-IN') : ''}"`;
                    });
                    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement('a');
                    link.setAttribute('href', encodedUri);
                    link.setAttribute('download', `AlgoTrading_Journal_${new Date().toISOString().slice(0, 10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition shadow-sm active:scale-95"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>{language === 'ml' ? 'ട്രേഡിംഗ് ജേർണൽ ഡൗൺലോഡ് (CSV)' : 'Export Trading Journal (CSV)'}</span>
                </button>

                <div className="p-3.5 px-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 flex justify-between items-center shadow-lg gap-4">
                   <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-extrabold text-slate-300">Total Net Realized P&L:</span>
                   </div>
                   <span className={`text-base font-black px-3 py-1 rounded-lg bg-black/40 border border-slate-700/50 ${accountSummary.netPnLAfterCharges >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {accountSummary.netPnLAfterCharges >= 0 ? '+' : ''}₹{accountSummary.netPnLAfterCharges.toFixed(2)}
                   </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

