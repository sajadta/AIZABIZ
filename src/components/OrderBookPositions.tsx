import React, { useState } from 'react';
import { 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  AlertOctagon, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Plus,
  Download,
  RefreshCw
} from 'lucide-react';
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
}



const PositionItem: React.FC<{ pos: Position, onSquareOff: (id: string) => void, isNew?: boolean }> = ({ pos, onSquareOff, isNew }) => {
  const [estCharges, setEstCharges] = React.useState<number | null>(null);
  const [chargeDetails, setChargeDetails] = React.useState<any | null>(null);
  const [showTaxBreakdown, setShowTaxBreakdown] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    const fetchCharges = async () => {
      try {
         // Buy charges
         let buyCharges = 0;
         let taxes: any = { brokerage: 0, stt: 0, gst: 0, stampDuty: 0, transactionCharge: 0, sebiCharge: 0 };
         if (pos.buyPrice && pos.quantity) {
             const r1 = await fetch(`/api/market/brokerage?instrumentToken=${encodeURIComponent(pos.instrumentKey || (pos.isOption ? 'NSE_FO|'+pos.symbol : 'NSE_EQ|'+pos.symbol))}&quantity=${pos.quantity}&product=${pos.productType || 'D'}&transactionType=BUY&price=${pos.buyPrice}`);
             if (r1.ok) {
                 const d1 = await r1.json();
                 buyCharges += d1?.data?.charges?.total || 0;
                 if (d1?.data?.charges) {
                   taxes.brokerage += d1.data.charges.brokerage || 0;
                   taxes.stt += d1.data.charges.taxes?.stt || 0;
                   taxes.gst += d1.data.charges.taxes?.gst || 0;
                   taxes.stampDuty += d1.data.charges.taxes?.stampDuty || 0;
                   taxes.transactionCharge += d1.data.charges.taxes?.transactionCharge || 0;
                   taxes.sebiCharge += d1.data.charges.taxes?.sebiCharge || 0;
                 }
             }
         }
         
         // Estimated Sell charges
         let sellCharges = 0;
         if (pos.currentLTP && pos.quantity) {
             const r2 = await fetch(`/api/market/brokerage?instrumentToken=${encodeURIComponent(pos.instrumentKey || (pos.isOption ? 'NSE_FO|'+pos.symbol : 'NSE_EQ|'+pos.symbol))}&quantity=${pos.quantity}&product=${pos.productType || 'D'}&transactionType=SELL&price=${pos.currentLTP}`);
             if (r2.ok) {
                 const d2 = await r2.json();
                 sellCharges += d2?.data?.charges?.total || 0;
                 if (d2?.data?.charges) {
                   taxes.brokerage += d2.data.charges.brokerage || 0;
                   taxes.stt += d2.data.charges.taxes?.stt || 0;
                   taxes.gst += d2.data.charges.taxes?.gst || 0;
                   taxes.stampDuty += d2.data.charges.taxes?.stampDuty || 0;
                   taxes.transactionCharge += d2.data.charges.taxes?.transactionCharge || 0;
                   taxes.sebiCharge += d2.data.charges.taxes?.sebiCharge || 0;
                 }
             }
         }
         
         if (isMounted) {
           setEstCharges(buyCharges + sellCharges);
           setChargeDetails(taxes);
         }
      } catch (e) {
         console.error('Failed to fetch position charges', e);
      }
    };
    fetchCharges();
    return () => { isMounted = false; };
  }, [pos.symbol, pos.buyPrice, pos.currentLTP, pos.quantity, pos.productType]);

  const gross = pos.pnl || 0;
  const net = estCharges !== null ? gross - estCharges : gross;

  return (
      <div className={`p-3.5 rounded-xl border flex flex-col gap-3 transition-all duration-300 ${
        isNew 
          ? (gross >= 0 ? 'animate-trade-glow-buy' : 'animate-trade-glow-sell')
          : 'bg-slate-900/80 border-slate-800 animate-row-enter'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-extrabold text-white">
              {pos.symbol}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              pos.isOption || pos.symbol.includes('CE') || pos.symbol.includes('PE')
                ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            }`}>
              {pos.isOption || pos.symbol.includes('CE') || pos.symbol.includes('PE')
                ? '🎯 OPTION PREMIUM (കരാർ പ്രീമിയം)' 
                : '📈 INDEX / EQUITY (ഓഹരി/സൂചിക)'}
            </span>
            <span className="text-[10px] font-mono text-slate-400 border border-slate-700/50 rounded px-1.5 py-0.2">
              Qty: <strong className="text-white">{pos.quantity}</strong>
            </span>
            {isNew && (
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                NEW POSITION
              </span>
            )}
          </div>
          <button
            onClick={() => onSquareOff(pos.id)}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold border border-rose-500/30 transition shadow-sm"
          >
            Exit
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500">Buy Price</span>
                <span className="text-slate-200 font-semibold">₹{pos.buyPrice?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500">Current (LTP)</span>
                <span className="text-slate-200 font-semibold">₹{pos.currentLTP?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500">Gross P&L</span>
                <span className={`font-semibold ${gross >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {gross >= 0 ? '+' : ''}₹{gross.toFixed(2)}
                </span>
            </div>
            <div className="flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">Net (After Tax)</span>
                  {estCharges !== null && (
                    <button 
                      onClick={() => setShowTaxBreakdown(!showTaxBreakdown)}
                      className="text-[9px] text-cyan-400 underline font-sans hover:text-cyan-300"
                    >
                      {showTaxBreakdown ? 'Hide' : 'Details'}
                    </button>
                  )}
                </div>
                <span className={`font-extrabold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
                </span>
            </div>
        </div>

        {/* Live In-Trade Next-Moment Trajectory & Fake-Dip Radar */}
        {pos.liveTrajectoryRadar && (
          <div className={`p-2.5 rounded-lg border text-[11px] flex flex-col gap-1.5 ${
            pos.liveTrajectoryRadar.nextMomentState === 'ACCELERATING_UP'
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : pos.liveTrajectoryRadar.nextMomentState === 'FAKE_DIP_HOLD'
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                : pos.liveTrajectoryRadar.nextMomentState === 'PEAK_EXHAUSTION'
                  ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
          }`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-extrabold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                {pos.liveTrajectoryRadar.nextMomentLabelMl}
              </span>
              <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-[10px] font-bold">
                {pos.liveTrajectoryRadar.holdOrExitVerdictMl}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/10 text-[10px] font-mono text-slate-300">
              <div>
                <span className="text-slate-400 block">Auto-Moving Target:</span>
                <strong className="text-emerald-300">
                  ₹{(pos.liveTrajectoryRadar.dynamicTargetPrice || pos.liveTrajectoryRadar.forecastedMaxOptionPrice).toFixed(2)} ↑
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Auto-Moving Stop-Loss:</span>
                <strong className="text-cyan-300">
                  ₹{(pos.liveTrajectoryRadar.dynamicStopLossPrice || pos.stopLoss || 0).toFixed(2)} ↑
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">Protected Net Floor:</span>
                <strong className={pos.liveTrajectoryRadar.protectedNetFloor >= 0 ? 'text-emerald-400' : 'text-amber-300'}>
                  {pos.liveTrajectoryRadar.protectedNetFloor >= 0
                    ? `Locked +₹${pos.liveTrajectoryRadar.protectedNetFloor} Net`
                    : `Max Risk ₹${Math.abs(pos.liveTrajectoryRadar.protectedNetFloor)}`}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">1m & Index Check:</span>
                <strong className="text-slate-200">
                  1m: {pos.liveTrajectoryRadar.option1mTrendIntact ? 'HL Intact ✓' : 'Peak/Break ⚠️'} | Idx: {pos.liveTrajectoryRadar.underlyingAligned ? 'Aligned ✓' : 'Reversed ⚠️'}
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Official Brokerage & Taxes Breakdown */}
        {showTaxBreakdown && chargeDetails && (
          <div className="p-2.5 rounded-lg bg-black/60 border border-cyan-500/30 text-[10px] font-mono grid grid-cols-2 sm:grid-cols-3 gap-2 animate-fadeIn">
            <div>
              <span className="text-slate-500 block">Brokerage (Flat):</span>
              <span className="text-slate-200 font-bold">₹{chargeDetails.brokerage.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">STT / CTT:</span>
              <span className="text-slate-200 font-bold">₹{chargeDetails.stt.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">GST (18%):</span>
              <span className="text-slate-200 font-bold">₹{chargeDetails.gst.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Exchange Turn.:</span>
              <span className="text-slate-200 font-bold">₹{chargeDetails.transactionCharge.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Stamp Duty:</span>
              <span className="text-slate-200 font-bold">₹{chargeDetails.stampDuty.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">SEBI Charges:</span>
              <span className="text-slate-200 font-bold">₹{chargeDetails.sebiCharge.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
  );
};

const TradeHistoryItem: React.FC<{ pos: Position, index: number }> = ({ pos, index }) => {
  const [estCharges, setEstCharges] = React.useState<number | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    const fetchCharges = async () => {
      try {
         // Buy charges
         let buyCharges = 0;
         if (pos.buyPrice && pos.quantity) {
             const r1 = await fetch(`/api/market/brokerage?instrumentToken=${encodeURIComponent(pos.instrumentKey || (pos.isOption ? 'NSE_FO|'+pos.symbol : 'NSE_EQ|'+pos.symbol))}&quantity=${pos.quantity}&product=${pos.productType || 'D'}&transactionType=BUY&price=${pos.buyPrice}`);
             if (r1.ok) {
                 const d1 = await r1.json();
                 buyCharges += d1?.data?.charges?.total || 0;
             }
         }
         
         // Sell charges
         let sellCharges = 0;
         const finalSellPrice = pos.sellPrice || pos.currentLTP;
         if (finalSellPrice && pos.quantity) {
             const r2 = await fetch(`/api/market/brokerage?instrumentToken=${encodeURIComponent(pos.instrumentKey || (pos.isOption ? 'NSE_FO|'+pos.symbol : 'NSE_EQ|'+pos.symbol))}&quantity=${pos.quantity}&product=${pos.productType || 'D'}&transactionType=SELL&price=${finalSellPrice}`);
             if (r2.ok) {
                 const d2 = await r2.json();
                 sellCharges += d2?.data?.charges?.total || 0;
             }
         }
         
         if (isMounted) setEstCharges(buyCharges + sellCharges);
      } catch (e) {
         console.error('Failed to fetch history charges', e);
      }
    };
    fetchCharges();
    return () => { isMounted = false; };
  }, [pos.symbol, pos.buyPrice, pos.sellPrice, pos.currentLTP, pos.quantity, pos.productType]);

  const gross = pos.realizedPnL || 0;
  const net = estCharges !== null ? gross - estCharges : gross;

  return (
      <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col gap-3 opacity-90 hover:opacity-100 transition">
        <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-extrabold text-white">
              {pos.symbol}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded border bg-slate-800 text-slate-200 border-slate-700">
              CLOSED
            </span>
            <span className="text-[10px] font-mono text-slate-400 border border-slate-700/50 rounded px-1.5 py-0.2">
              Qty: <strong className="text-slate-200">{pos.quantity}</strong>
            </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/30">
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500">Buy Price</span>
                <span className="text-slate-400">₹{pos.buyPrice?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500">Sell Price</span>
                <span className="text-slate-400">₹{pos.sellPrice?.toFixed(2) || pos.currentLTP?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500">Gross P&L</span>
                <span className={`font-semibold ${gross >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {gross >= 0 ? '+' : ''}₹{gross.toFixed(2)}
                </span>
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-500">Net P&L {estCharges !== null ? `(-₹${estCharges.toFixed(2)} Tax)` : '(Calc...)'}</span>
                <span className={`font-bold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
                </span>
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
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'POSITIONS' | 'HOLDINGS' | 'ORDERS' | 'TRADE_HISTORY'>(initialTab);
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'OPTIONS' | 'INDEX_EQUITY'>('ALL');

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

  // Compute combined Summary Stats (Active Positions + Executed Trade History): Total Profit, Total Loss, Total Brokerage Charges, Net P&L
  const accountSummary = React.useMemo(() => {
    let totalGrossProfit = 0;
    let totalGrossLoss = 0;
    let totalBrokerageCharges = 0;

    // 1. Open positions
    positions.forEach((p) => {
      const isOpt = Boolean(p.isOption || /\b(CE|PE)\b/i.test(p.symbol || '') || String(p.instrumentKey || '').includes('FO'));
      const buyP = Number(p.buyPrice || 0);
      const curP = Number(p.currentLTP || buyP);
      const qty = Math.max(1, Number(p.quantity || 1));
      const pnl = p.pnl !== undefined ? Number(p.pnl) : (curP - buyP) * qty;
      if (pnl >= 0) totalGrossProfit += pnl;
      else totalGrossLoss += Math.abs(pnl);

      const chg = calculateTradeCharges(buyP, qty, isOpt, curP);
      totalBrokerageCharges += chg.roundTripCharges;
    });

    // 2. Closed trade history
    tradeHistory.forEach((t) => {
      const isOpt = Boolean(t.isOption || /\b(CE|PE)\b/i.test(t.symbol || '') || String(t.instrumentKey || '').includes('FO'));
      const buyP = Number(t.buyPrice || 0);
      const sellP = Number(t.sellPrice || t.currentLTP || buyP);
      const qty = Math.max(1, Number(t.quantity || 1));
      const pnl = t.realizedPnL !== undefined ? Number(t.realizedPnL) : (sellP - buyP) * qty;
      if (pnl >= 0) totalGrossProfit += pnl;
      else totalGrossLoss += Math.abs(pnl);

      const chg =
        Number((t as any).brokerageCharges) > 0
          ? Number((t as any).brokerageCharges)
          : calculateTradeCharges(buyP, qty, isOpt, sellP).roundTripCharges;
      totalBrokerageCharges += chg;
    });

    const netPnLAfterCharges = totalGrossProfit - totalGrossLoss - totalBrokerageCharges;
    return {
      totalGrossProfit,
      totalGrossLoss,
      totalBrokerageCharges,
      netPnLAfterCharges,
    };
  }, [positions, tradeHistory]);

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
              <span>{t.executedOrders}</span>
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
              <span>{language === 'ml' ? 'ട്രേഡ് ഹിസ്റ്ററി' : 'Trade History'}</span>
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

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto smooth-scroll p-3 sm:p-4 pb-20 sm:pb-6">
        
        {/* POSITIONS TAB */}
        {activeTab === 'POSITIONS' && (
          <div className="space-y-3">
            {/* Live Total Profit, Total Loss, Total Brokerage Charges & Net P&L Summary */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-800/50">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300/90 block">
                  {language === 'ml' ? 'ആകെ ലാഭം (Total Profit)' : 'Total Profit'}
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-0.5 block">
                  +₹{accountSummary.totalGrossProfit.toFixed(2)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-rose-950/25 border border-rose-800/50">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-300/90 block">
                  {language === 'ml' ? 'ആകെ നഷ്ടം (Total Loss)' : 'Total Loss'}
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-rose-400 mt-0.5 block">
                  -₹{accountSummary.totalGrossLoss.toFixed(2)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-950/25 border border-amber-800/50">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300/90 block">
                  {language === 'ml' ? 'ആകെ ബ്രോക്കറേജ് ചാർജ്' : 'Total Brokerage Charges'}
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-amber-400 mt-0.5 block">
                  ₹{accountSummary.totalBrokerageCharges.toFixed(2)}
                </span>
              </div>
              <div className={`p-3 rounded-xl border ${
                accountSummary.netPnLAfterCharges >= 0
                  ? 'bg-emerald-950/30 border-emerald-500/40'
                  : 'bg-rose-950/30 border-rose-500/40'
              }`}>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300 block">
                  {language === 'ml' ? 'അറ്റ ലാഭം / നഷ്ടം (Net P&L)' : 'Net P&L (After Charges)'}
                </span>
                <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${
                  accountSummary.netPnLAfterCharges >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {accountSummary.netPnLAfterCharges >= 0 ? '+' : '-'}₹{Math.abs(accountSummary.netPnLAfterCharges).toFixed(2)}
                </span>
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
                  const invested = h.investedValue || (h.quantity * (h.buyPrice ?? h.avgPrice ?? 0));
                  const currentVal = h.currentValue || (h.quantity * (h.currentLTP || 0));
                  const pnl = h.pnl !== undefined ? h.pnl : (currentVal - invested);
                  const pnlPercent = h.pnlPercent !== undefined ? h.pnlPercent : (invested > 0 ? (pnl / invested) * 100 : 0);
                  const isGain = pnl >= 0;

                  return (
                    <div key={idx} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-3 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-extrabold text-white">{h.symbol}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              DELIVERY · CNC
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{h.companyName || `${h.symbol} Ltd`}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold font-mono text-white">₹{(h.currentLTP || 0).toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">LTP</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-center font-mono">
                        <div>
                          <span className="text-[9px] text-slate-400 block">{language === 'ml' ? 'അളവ്' : 'Qty'}</span>
                          <span className="text-xs font-bold text-slate-200">{h.quantity}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block">{language === 'ml' ? 'ശരാശരി വില' : 'Avg Price'}</span>
                          <span className="text-xs font-bold text-slate-200">₹{Number(h.buyPrice ?? h.avgPrice ?? 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block">{language === 'ml' ? 'ലാഭം / നഷ്ടം' : 'P&L'}</span>
                          <span className={`text-xs font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isGain ? '+' : ''}₹{pnl.toFixed(2)}
                            <span className="block text-[9px]">({pnlPercent.toFixed(2)}%)</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                        <div className="text-[11px] text-slate-400">
                          <span>{language === 'ml' ? 'നിലവിലെ മൂല്യം' : 'Cur Value'}: </span>
                          <strong className="text-slate-200 font-mono">₹{currentVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                        </div>

                        {onOpenOrderModal && (
                          <div className="flex items-center gap-1.5">
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
                          </div>
                        )}
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
          <div className="space-y-2.5">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
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
                  const matchingOpenPos = positions.find(p => p.symbol === ord.symbol);
                  const matchingClosedTrade = tradeHistory.find(t => t.symbol === ord.symbol);
                  const currentOrExitPx = matchingOpenPos
                    ? Number(matchingOpenPos.currentLTP || execPx)
                    : matchingClosedTrade
                      ? Number(matchingClosedTrade.sellPrice || matchingClosedTrade.currentLTP || execPx)
                      : execPx;
                  const ordCharges = calculateTradeCharges(execPx, qty, isOpt, currentOrExitPx);
                  const grossPnl = matchingOpenPos
                    ? Number(matchingOpenPos.pnl ?? (currentOrExitPx - execPx) * qty)
                    : matchingClosedTrade
                      ? Number(matchingClosedTrade.realizedPnL ?? (currentOrExitPx - execPx) * qty)
                      : 0;
                  const netPnlAfterTax = Number((grossPnl - ordCharges.roundTripCharges).toFixed(2));

                  return (
                    <div
                      key={ord.id}
                      className={`p-3.5 rounded-xl border flex flex-col gap-2.5 text-xs font-mono transition-all duration-300 ${
                        isNew
                          ? (isBuy ? 'animate-trade-glow-buy' : 'animate-trade-glow-sell')
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 animate-row-enter'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black w-12 text-center ${
                            isBuy
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}>
                            {ord.transactionType}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white font-sans text-sm">{ord.symbol}</span>
                              {isNew && (
                                <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                                  <span className="w-1 h-1 rounded-full bg-cyan-400"></span>
                                  {language === 'ml' ? 'പുതിയ ട്രേഡ്' : 'EXECUTED'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-slate-400 text-[10px]">{ord.timestamp}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-700" />
                              <span className="text-slate-300 text-[10px]">Qty: <strong>{qty}</strong></span>
                              {ord.productType && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                                  <span className="text-slate-400 text-[10px]">{ord.productType}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-bold text-sm mb-0.5">
                            ₹{execPx.toFixed(2)}
                          </div>
                          <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{ord.status}</span>
                          </div>
                        </div>
                      </div>

                      {/* Trade Details & Net P&L Breakdown Bar inside Order Card */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[10px] bg-slate-950/50 p-2 rounded-lg">
                        <div>
                          <span className="text-slate-500 block font-sans">{language === 'ml' ? 'ട്രേഡ് മൂല്യം (Value)' : 'Trade Value'}</span>
                          <span className="text-slate-200 font-bold">₹{ordCharges.tradeValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-sans">{language === 'ml' ? 'നിലവിലെ വില / Exit' : 'Current / Exit LTP'}</span>
                          <span className="text-cyan-300 font-bold">₹{currentOrExitPx.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-sans">{language === 'ml' ? 'ബ്രോക്കറേജ് & ടാക്സ്' : 'Brokerage & Tax'}</span>
                          <span className="text-amber-300 font-bold">-₹{ordCharges.roundTripCharges.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block font-sans">{language === 'ml' ? 'അറ്റ ലാഭം / നഷ്ടം (Net P&L)' : 'Net P&L (After Tax)'}</span>
                          <span className={`font-black ${netPnlAfterTax >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {netPnlAfterTax >= 0 ? '+' : ''}₹{netPnlAfterTax.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
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

            {tradeHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                <p className="text-xs font-semibold">
                  {language === 'ml' ? 'ഇന്ന് പൂർത്തിയാക്കിയ ട്രേഡുകൾ ഒന്നുമില്ല.' : 'No completed trades for today.'}
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
                
                return (
                <div key={pos.id} className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3 relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none ${net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  
                  <div className="flex justify-between items-start z-10">
                      <div>
                          <div className="flex items-center gap-2 mb-1.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${((pos as any).type || 'BUY') === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                                  {(pos as any).type || 'BUY'}
                              </span>
                              <span className="font-extrabold text-white text-sm">{pos.symbol}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                              Qty: <strong className="text-slate-200">{pos.quantity}</strong>
                          </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-1 rounded-md border border-slate-800 uppercase tracking-wider">{pos.closeTime ? new Date(pos.closeTime).toLocaleTimeString() : 'CLOSED'}</span>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-black/30 p-3 rounded-xl border border-slate-800/40 z-10">
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Buy Price</span>
                          <span className="text-slate-300 font-semibold">₹{pos.buyPrice?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Sell Price</span>
                          <span className="text-slate-300 font-semibold">₹{pos.sellPrice?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Gross P&L</span>
                          <span className={`font-bold ${gross >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {gross >= 0 ? '+' : ''}₹{gross.toFixed(2)}
                          </span>
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Net P&L (-₹{estCharges.toFixed(2)} Charges)</span>
                          <span className={`font-black text-sm ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
                          </span>
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

