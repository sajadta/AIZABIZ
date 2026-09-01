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
  ArrowDownRight
} from 'lucide-react';
import { Order, Position, Holding, Language } from '../types';
import { translations } from '../translations';

interface OrderBookPositionsProps {
  positions: Position[];
  orders: Order[];
  tradeHistory?: Position[];
  language: Language;
  onSquareOffPosition: (positionId: string) => void;
  onSquareOffAll: () => void;
  totalPnL: number;
}



const PositionItem: React.FC<{ pos: Position, onSquareOff: (id: string) => void }> = ({ pos, onSquareOff }) => {
  const [estCharges, setEstCharges] = React.useState<number | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    const fetchCharges = async () => {
      try {
         // Buy charges
         let buyCharges = 0;
         if (pos.buyPrice && pos.quantity) {
             const r1 = await fetch(`/api/upstox/brokerage?instrumentToken=${encodeURIComponent(pos.instrumentKey || (pos.isOption ? 'NSE_FO|'+pos.symbol : 'NSE_EQ|'+pos.symbol))}&quantity=${pos.quantity}&product=${pos.productType || 'D'}&transactionType=BUY&price=${pos.buyPrice}`);
             if (r1.ok) {
                 const d1 = await r1.json();
                 buyCharges += d1?.data?.charges?.total || 0;
             }
         }
         
         // Estimated Sell charges
         let sellCharges = 0;
         if (pos.currentLTP && pos.quantity) {
             const r2 = await fetch(`/api/upstox/brokerage?instrumentToken=${encodeURIComponent(pos.instrumentKey || (pos.isOption ? 'NSE_FO|'+pos.symbol : 'NSE_EQ|'+pos.symbol))}&quantity=${pos.quantity}&product=${pos.productType || 'D'}&transactionType=SELL&price=${pos.currentLTP}`);
             if (r2.ok) {
                 const d2 = await r2.json();
                 sellCharges += d2?.data?.charges?.total || 0;
             }
         }
         
         if (isMounted) setEstCharges(buyCharges + sellCharges);
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
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-extrabold text-white">
              {pos.symbol}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
              pos.isOption ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            }`}>
              {pos.isOption ? 'OPTION' : 'EQUITY'}
            </span>
            <span className="text-[10px] font-mono text-slate-400 border border-slate-700/50 rounded px-1.5 py-0.2">
              Qty: <strong className="text-white">{pos.quantity}</strong>
            </span>
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
                <span className="text-[10px] text-slate-500">Net P&L {estCharges !== null ? `(-₹${estCharges.toFixed(2)} Tax)` : '(Calc...)'}</span>
                <span className={`font-extrabold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
                </span>
            </div>
        </div>
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
             const r1 = await fetch(`/api/upstox/brokerage?instrumentToken=${encodeURIComponent(pos.instrumentKey || (pos.isOption ? 'NSE_FO|'+pos.symbol : 'NSE_EQ|'+pos.symbol))}&quantity=${pos.quantity}&product=${pos.productType || 'D'}&transactionType=BUY&price=${pos.buyPrice}`);
             if (r1.ok) {
                 const d1 = await r1.json();
                 buyCharges += d1?.data?.charges?.total || 0;
             }
         }
         
         // Sell charges
         let sellCharges = 0;
         const finalSellPrice = pos.sellPrice || pos.currentLTP;
         if (finalSellPrice && pos.quantity) {
             const r2 = await fetch(`/api/upstox/brokerage?instrumentToken=${encodeURIComponent(pos.instrumentKey || (pos.isOption ? 'NSE_FO|'+pos.symbol : 'NSE_EQ|'+pos.symbol))}&quantity=${pos.quantity}&product=${pos.productType || 'D'}&transactionType=SELL&price=${finalSellPrice}`);
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
  language,
  onSquareOffPosition,
  onSquareOffAll,
  totalPnL,
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'POSITIONS' | 'ORDERS' | 'TRADE_HISTORY'>('POSITIONS');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header & Tabs */}
      <div className="pb-3 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Briefcase className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-white tracking-tight uppercase">
              {t.ordersPositions}
            </h3>
          </div>

          <div className="flex bg-black/20 p-0.5 rounded-xl border border-slate-800 text-xs font-black shadow-inner">
            <button
              onClick={() => setActiveTab('POSITIONS')}
              className={`px-3 py-1 rounded-lg transition ${
                activeTab === 'POSITIONS'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.activePositions} ({positions.length})
            </button>
            <button
              onClick={() => setActiveTab('ORDERS')}
              className={`px-3 py-1 rounded-lg transition ${
                activeTab === 'ORDERS'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.executedOrders} ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('TRADE_HISTORY')}
              className={`px-3 py-1 rounded-lg transition ${
                activeTab === 'TRADE_HISTORY'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {language === 'ml' ? 'ട്രേഡ് ഹിസ്റ്ററി' : 'Trade History'} ({tradeHistory.length})
            </button>
          </div>
        </div>

        {/* Total PnL Banner & Panic Square Off */}
        {positions.length > 0 && (
          <div className="flex items-center gap-2">
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
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        
        {/* POSITIONS TAB */}
        {activeTab === 'POSITIONS' && (
          <div className="space-y-2.5">
            {positions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                <p className="text-xs font-semibold">
                  {language === 'ml' ? 'നിലവിൽ ഓപ്പൺ പൊസിഷനുകൾ ഒന്നുമില്ല.' : 'No open trading positions.'}
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  {language === 'ml' ? 'ഓട്ടോ-ട്രേഡിംഗ് ആരംഭിക്കുകയോ മാനുവൽ ഓർഡർ നൽകുകയോ ചെയ്യുക.' : 'Start the Algo Bot or place a manual order from the watchlist.'}
                </p>
              </div>
            ) : (
              positions.map((pos) => (
                <PositionItem key={pos.id + "-" + pos.productType} pos={pos} onSquareOff={onSquareOffPosition} />
              ))
            )}
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'ORDERS' && (
          <div className="space-y-2">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                <p className="text-xs font-semibold">
                  {language === 'ml' ? 'ഇതുവരെ ഓർഡറുകൾ ഒന്നും നൽകിയിട്ടില്ല.' : 'No orders recorded in this session.'}
                </p>
              </div>
            ) : (
              orders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ord.transactionType === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {ord.transactionType}
                    </span>
                    <div>
                      <span className="font-bold text-white font-sans">{ord.symbol}</span>
                      <span className="text-slate-500 text-[10px] block">{ord.timestamp}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-slate-200">
                      {ord.quantity} Qty @ ₹{ord.executedPrice || ord.price}
                    </div>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{ord.status}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
};
