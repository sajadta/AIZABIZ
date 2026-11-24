import React from 'react';
import { Briefcase, TrendingUp, TrendingDown, Clock, BarChart2, Zap, Target } from 'lucide-react';
import type { Position, Language } from '../../types';
import { calculateTradeCharges } from '../../utils/indicators';
export const PositionItem: React.FC<{
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
    const breakdown = calculateTradeCharges(buyPx, qty, isOpt, curPx, pos.instrumentKey || pos.symbol);
    return {
      total: breakdown.roundTripCharges,
      entryPaid: breakdown.buyCharges,
      exitEst: breakdown.sellCharges,
      details: {
        brokerage: breakdown.buyBrokerage + breakdown.sellBrokerage,
        stt: breakdown.stt,
        gst: breakdown.gst,
        stampDuty: breakdown.stampDuty,
        transactionCharge: breakdown.exchangeTxnCharge,
        sebiCharge: breakdown.sebiCharge,
      },
    };
  }, [buyPx, qty, isOpt, curPx, pos.instrumentKey, pos.symbol]);
  const [apiCharges, setApiCharges] = React.useState<{
    total: number;
    details: any;
    isLiveUpstox?: boolean;
  } | null>(null);
  const [showTaxBreakdown, setShowTaxBreakdown] = React.useState(false);
  const estCharges = apiCharges?.total ?? defaultCharges.total;
  const chargeDetails = apiCharges?.details ?? defaultCharges.details;
  React.useEffect(() => {
    let isMounted = true;
    const fetchCharges = async () => {
      try {
        if (!pos.buyPrice || !pos.quantity) return;
        const isBseInst = /SENSEX|BANKEX|BSE/i.test(pos.symbol || '');
        const instToken =
          pos.instrumentKey ||
          (pos.isOption ? (isBseInst ? 'BSE_FO|' : 'NSE_FO|') + pos.symbol : 'NSE_EQ|' + pos.symbol);
        const prod = pos.productType || 'D';
        const currentPx = pos.currentLTP || pos.buyPrice;
        // Fetch Live Round-Trip Brokerage & Taxes directly from Upstox API via server cache
        const r = await fetch(
          `/api/market/brokerage?instrumentToken=${encodeURIComponent(instToken)}&quantity=${pos.quantity}&product=${prod}&buyPrice=${pos.buyPrice}&sellPrice=${currentPx}&roundTrip=true`,
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
                transactionCharge: Number(
                  charges.other_charges?.transaction ?? charges.taxes?.transactionCharge ?? 0,
                ),
                sebiCharge: Number(
                  charges.other_charges?.sebi_turnover ?? charges.taxes?.sebiCharge ?? 0,
                ),
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
    return () => {
      isMounted = false;
    };
  }, [pos.symbol, pos.instrumentKey, pos.buyPrice, pos.currentLTP, pos.quantity, pos.productType]);
  const gross = pos.pnl || 0;
  const net = estCharges !== null ? gross - estCharges : gross;
  const target50Px = Number((buyPx * 1.5).toFixed(2));
  const is50PctHit = buyPx > 0 && curPx >= target50Px;
  const progressTo50 =
    buyPx > 0 ? Math.max(0, Math.min(100, ((curPx - buyPx) / (buyPx * 0.5)) * 100)) : 0;
  const isHighProfit = net >= 1000 || is50PctHit;
  return (
    <div
      className={`p-0 rounded-2xl border transition-all duration-500 backdrop-blur-md relative overflow-hidden group shadow-[0_8px_30px_rgb(0,0,0,0.4)] ${
        is50PctHit
          ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
          : isHighProfit
            ? 'bg-emerald-500/10 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
            : gross < 0
              ? 'bg-rose-500/10 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
              : 'bg-slate-900/60 border-slate-800/60 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)]'
      }`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-tr ${gross >= 0 ? 'from-emerald-500/5' : 'from-rose-500/5'} to-transparent pointer-events-none opacity-40`}
      />
      {/* Glow accent bar at top */}
      <div
        className={`h-1 w-full ${is50PctHit ? 'bg-amber-500' : isHighProfit ? 'bg-emerald-500' : gross < 0 ? 'bg-rose-500' : 'bg-slate-700'} shadow-[0_0_15px_rgba(0,0,0,0.5)]`}
      />
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2 rounded-xl border shrink-0 ${
                isOpt
                  ? 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {isOpt ? <Zap className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-white truncate tracking-tight">
                  {pos.symbol}
                </span>
                {isNew && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[8px] font-black uppercase animate-pulse">
                    NEW
                  </span>
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
                <span className="text-[11px] font-black uppercase hidden sm:inline">
                  {language === 'ml' ? 'ചാർട്ട്' : 'Chart'}
                </span>
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
            <span className="text-amber-400/90 font-black font-mono text-sm">
              ₹{target50Px.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5">
              <div
                className={`w-1 h-1 rounded-full ${gross >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
              />{' '}
              Gross P&L
            </span>
            <span
              className={`text-sm font-black font-mono ${gross >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {gross >= 0 ? '+' : ''}₹{gross.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:text-right">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1.5 sm:justify-end">
              <div
                className={`w-1 h-1 rounded-full ${net >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
              />{' '}
              {language === 'ml' ? 'എക്സിറ്റ് അറ്റ ലാഭം' : 'Net After Exit'}
            </span>
            <span
              className={`text-base font-black font-mono ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'} drop-shadow-[0_0_12px_rgba(52,211,153,0.3)] flex items-center gap-1`}
            >
              {apiCharges?.isLiveUpstox && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                  title="Upstox Live API Verified"
                />
              )}
              {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
            </span>
          </div>
        </div>
        {/* Progress to Target */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Target className="w-3 h-3 text-amber-500" />
              {language === 'ml' ? 'ലാഭ ലക്ഷ്യം' : 'Profit Target'}:{' '}
              <span className="text-slate-200">₹{target50Px} (+50%)</span>
            </span>
            <span className={is50PctHit ? 'text-amber-400' : 'text-cyan-400'}>
              {progressTo50.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
            <div
              className={`h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(34,211,238,0.2)] ${
                is50PctHit
                  ? 'bg-gradient-to-r from-emerald-500 to-amber-400'
                  : 'bg-gradient-to-r from-cyan-600 to-emerald-500'
              }`}
              style={{ width: `${progressTo50}%` }}
            />
          </div>
        </div>
      </div>
      {/* Dynamic status labels at bottom */}
      <div className="px-5 py-2.5 bg-black/40 border-t border-slate-800/40 flex items-center justify-between text-[10px] font-bold flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Clock className="w-3 h-3" />
            {pos.openedAt}
          </span>
          <span
            className={`flex items-center gap-1.5 ${net >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}
          >
            {net >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {net >= 0
              ? language === 'ml'
                ? 'അറ്റ ലാഭത്തിൽ'
                : 'Net In Profit'
              : gross >= 0
                ? language === 'ml'
                  ? 'ഗ്രോസ് ലാഭം (ചാർജ് കഴിഞ്ഞാൽ നഷ്ടം)'
                  : 'Gross+ / Fee Drag'
                : language === 'ml'
                  ? 'നഷ്ടത്തിൽ'
                  : 'In Loss'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 flex items-center gap-1"
            title={`Entry Fee Paid: ₹${defaultCharges.entryPaid.toFixed(2)} | Est. Exit Fee: ₹${Math.max(0, estCharges - defaultCharges.entryPaid).toFixed(2)}`}
          >
            {apiCharges?.isLiveUpstox && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                title="Upstox Live API"
              />
            )}
            {language === 'ml' ? 'എക്സിറ്റ് RT ചാർജ്' : 'Est. RT Fee'}: ₹
            {estCharges.toFixed(2)}
            <span className="text-slate-400 font-normal">
              ({language === 'ml' ? 'വാങ്ങിയ ഫീ' : 'Paid'}: ₹{defaultCharges.entryPaid.toFixed(2)})
            </span>
          </span>
          {showTaxBreakdown ? (
            <button
              onClick={() => setShowTaxBreakdown(false)}
              className="text-cyan-500 hover:text-cyan-400 uppercase tracking-tighter text-[9px] font-black flex items-center gap-1"
            >
              {apiCharges?.isLiveUpstox && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              {language === 'ml' ? 'മറയ്ക്കുക' : 'Hide'}
            </button>
          ) : (
            <button
              onClick={() => setShowTaxBreakdown(true)}
              className="text-slate-400 hover:text-cyan-400 uppercase tracking-tighter text-[9px] font-black flex items-center gap-1"
            >
              {apiCharges?.isLiveUpstox && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              {language === 'ml' ? 'വിശദാംശങ്ങൾ' : 'View Details'}
            </button>
          )}
        </div>
      </div>
      {showTaxBreakdown && chargeDetails && (
        <div className="p-4 bg-black/80 border-t border-cyan-900/30 text-[10px] font-mono grid grid-cols-2 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="col-span-full pb-1 border-b border-slate-800/60 flex items-center justify-between text-[9px] flex-wrap gap-2">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              ⚡{' '}
              {language === 'ml'
                ? 'Upstox ലൈവ് ഒഫീഷ്യൽ ബ്രോക്കറേജ് (വാങ്ങൽ + വിൽക്കൽ RT)'
                : 'Upstox Live Official Brokerage (Round-Trip)'}
            </span>
            <span className="text-slate-400">
              Entry Paid: ₹{defaultCharges.entryPaid.toFixed(2)} • Est. RT Total: ₹
              {estCharges.toFixed(2)}
            </span>
          </div>
          {Object.entries(chargeDetails).map(([key, val]: [string, any]) => (
            <div key={key} className="flex flex-col">
              <span className="text-slate-500 uppercase text-[8px]">
                {key.replace(/([A-Z])/g, ' $1')}
              </span>
              <span className="text-slate-300 font-bold">₹{Number(val || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
