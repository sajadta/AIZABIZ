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
  language: Language;
  onSquareOffPosition: (positionId: string) => void;
  onSquareOffAll: () => void;
  totalPnL: number;
}

export const OrderBookPositions: React.FC<OrderBookPositionsProps> = ({
  positions,
  orders,
  language,
  onSquareOffPosition,
  onSquareOffAll,
  totalPnL,
}) => {
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'POSITIONS' | 'ORDERS'>('POSITIONS');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header & Tabs */}
      <div className="pb-3 border-b border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Briefcase className="w-4 h-4" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-white tracking-tight uppercase">
              {t.ordersPositions}
            </h3>
          </div>

          <div className="flex bg-[#070a14] p-0.5 rounded-xl border border-slate-800 text-xs font-black shadow-inner">
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
              positions.map((pos) => {
                const isProfit = pos.pnl >= 0;
                return (
                  <div
                    key={pos.id + "-" + pos.productType}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-white">
                          {pos.symbol}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                          pos.isOption ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        }`}>
                          {pos.isOption ? 'OPTION' : 'EQUITY'}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {pos.productType}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Qty: <strong className="text-white">{pos.quantity}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono text-slate-400 mt-1">
                        <span>Avg: ₹{pos.buyPrice}</span>
                        <span>LTP: <strong className="text-slate-200">₹{pos.currentLTP}</strong></span>
                        {pos.stopLoss && <span>SL: ₹{pos.stopLoss}</span>}
                      </div>
                      
                      {pos.taxes && (
                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 mt-1.5">
                          <span>Brokerage/Tax: ₹{pos.taxes.totalCharges}</span>
                          <span className={pos.pnl >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}>
                            Gross P&L: ₹{pos.pnl}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* PnL Display */}
                      <div className="text-right font-mono">
                        <div className="text-[10px] text-slate-400 font-semibold mb-0.5">NET P&L</div>
                        <div className={`text-sm font-extrabold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pos.pnl >= 0 ? `+₹${pos.pnl?.toFixed(2)}` : `-₹${Math.abs(pos.pnl || 0).toFixed(2)}`}
                        </div>
                      </div>

                      {/* Exit Button */}
                      <button
                        onClick={() => onSquareOffPosition(pos.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition"
                      >
                        Exit
                      </button>
                    </div>
                  </div>
                );
              })
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
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
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
