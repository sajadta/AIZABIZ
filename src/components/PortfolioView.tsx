import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Position, Holding, Order, UpstoxApiConfig } from '../types';
import { PieChart, Clock, TrendingUp, TrendingDown, DollarSign, Target, Activity } from 'lucide-react';

interface PortfolioViewProps {
  positions: Position[];
  holdings: Holding[];
  orders: Order[];
  apiConfig: UpstoxApiConfig | null;
  language: 'en' | 'ml';
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({ positions, holdings, orders, apiConfig, language }) => {
  const [activeTab, setActiveTab] = useState<'POSITIONS' | 'ORDERS' | 'HOLDINGS'>('POSITIONS');

  // Calculate overall PNL
  const totalPositionsPnL = positions.reduce((acc, p) => acc + (p.pnl || 0), 0);
  const totalHoldingsPnL = holdings.reduce((acc, h) => acc + (h.pnl || 0), 0);
  const overallPnL = totalPositionsPnL + totalHoldingsPnL;
  const isProfit = overallPnL >= 0;

  const totalInvested = 
    positions.reduce((acc, p) => acc + ((p.quantity || 0) * (p.buyPrice || 0)), 0) + 
    holdings.reduce((acc, h) => acc + ((h.quantity || 0) * (h.buyPrice ?? h.avgPrice ?? 0)), 0);

  const approxTaxes = (orders.length * 20) + (orders.length * 5); // Rough est: ₹20/order + STT

  const renderTabButton = (id: 'POSITIONS' | 'ORDERS' | 'HOLDINGS', labelEn: string, labelMl: string) => {
    const isActive = activeTab === id;
    return (
      <button 
        onClick={() => setActiveTab(id)}
        className={`relative flex-1 py-2 text-xs font-bold transition-colors z-10 ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
      >
        {language === 'ml' ? labelMl : labelEn}
        {isActive && (
          <motion.div 
            layoutId="portfolioTabIndicator"
            className="absolute inset-0 bg-white/10 rounded-xl border border-slate-700/80"
            initial={false}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
      </button>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col flex-1 h-full gap-4"
    >
      {/* 1. Overall Performance Banner (Profit & Loss summary) */}
      <div className="bg-[#0b0f19] p-4 rounded-2xl border border-slate-700/80 relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <Activity className="w-24 h-24" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {language === 'ml' ? 'മൊത്തം ലാഭം/നഷ്ടം (Overall P&L)' : 'Overall Profit & Loss'}
            </p>
            <div className="flex items-baseline gap-2">
              <h2 className={`text-3xl font-black ${isProfit ? 'text-emerald-400 profit-glow' : 'text-rose-400 loss-glow'}`}>
                {isProfit ? '+' : ''}₹{overallPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </h2>
              {totalInvested > 0 && (
                <span className={`text-sm font-bold ${isProfit ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                  ({((overallPnL / totalInvested) * 100).toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-4">
             <div className="bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                <p className="text-[9px] text-slate-400 uppercase">Invested</p>
                <p className="text-sm font-bold text-white">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
             </div>
             <div className="bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                <p className="text-[9px] text-slate-400 uppercase">Est. Taxes</p>
                <p className="text-sm font-bold text-amber-400">~₹{approxTaxes.toLocaleString('en-IN')}</p>
             </div>
          </div>
        </div>
      </div>

      {/* 2. Segmented Tabs for inner navigation */}
      <div className="bg-slate-900/80 p-1 rounded-2xl border border-slate-800 flex shrink-0 relative">
        {renderTabButton('POSITIONS', `Positions (${positions.length})`, `പൊസിഷനുകൾ (${positions.length})`)}
        {renderTabButton('ORDERS', `Orders (${orders.length})`, `ഓർഡറുകൾ (${orders.length})`)}
        {renderTabButton('HOLDINGS', `Holdings (${holdings.length})`, `ഹോൾഡിങ്‌സ് (${holdings.length})`)}
      </div>

      {/* 3. Tab Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          
          {activeTab === 'POSITIONS' && (
            <motion.div 
              key="positions"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 overflow-y-auto hide-scrollbar space-y-3 pb-24"
            >
              {positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                   <Target className="w-8 h-8 mb-2 opacity-50" />
                   <p className="text-xs">{language === 'ml' ? 'സജീവ പൊസിഷനുകൾ ഇല്ല' : 'No active positions.'}</p>
                </div>
              ) : (
                positions.map((p, i) => {
                  const invested = (p.quantity || 0) * (p.buyPrice || 0);
                  const currentVal = (p.quantity || 0) * (p.currentLTP || 0);
                  const pIsProfit = p.pnl >= 0;
                  return (
                    <motion.div 
                      key={i} 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-slate-100">{p.symbol}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Qty: {p.quantity} @ ₹{Number(p.buyPrice || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-white font-mono">₹{Number(p.currentLTP || 0).toFixed(2)}</p>
                          <p className={`text-[11px] font-bold ${pIsProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pIsProfit ? '+' : ''}{Number(p.pnl || 0).toFixed(2)} ({p.pnlPercent ? p.pnlPercent.toFixed(2) : '0.00'}%)
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {activeTab === 'ORDERS' && (
            <motion.div 
              key="orders"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 overflow-y-auto hide-scrollbar space-y-3 pb-24"
            >
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                   <Clock className="w-8 h-8 mb-2 opacity-50" />
                   <p className="text-xs">{language === 'ml' ? 'ഓർഡറുകൾ ഒന്നുമില്ല' : 'No recent orders.'}</p>
                </div>
              ) : (
                orders.slice().reverse().map((o, i) => {
                  const isBuy = o.transactionType === 'BUY';
                  return (
                    <motion.div 
                      key={i} 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                             <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isBuy ? 'bg-blue-500/20 text-blue-400' : 'bg-rose-500/20 text-rose-400'}`}>
                               {o.transactionType}
                             </span>
                             <span className="text-xs font-bold text-slate-200">{o.symbol}</span>
                           </div>
                           <p className="text-[10px] text-slate-400">{o.productType} • {o.orderType}</p>
                        </div>
                        <div className="text-right">
                           <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                             o.status === 'COMPLETE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 
                             o.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 
                             'bg-slate-700/50 text-slate-300 border border-slate-600'
                           }`}>
                             {o.status}
                           </span>
                           <p className="text-[10px] text-white font-mono mt-1">
                             Qty: {o.quantity} @ ₹{(o.executedPrice || o.price || 0).toFixed(2)}
                           </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {activeTab === 'HOLDINGS' && (
            <motion.div 
              key="holdings"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute inset-0 overflow-y-auto hide-scrollbar space-y-3 pb-24"
            >
              {holdings.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                   <PieChart className="w-8 h-8 mb-2 opacity-50" />
                   <p className="text-xs">{language === 'ml' ? 'ഹോൾഡിങ്‌സ് ഇല്ല' : 'No long-term holdings.'}</p>
                </div>
              ) : (
                holdings.map((h, i) => {
                  const hIsProfit = h.pnl >= 0;
                  return (
                    <motion.div 
                      key={i} 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-bold text-slate-100">{h.symbol}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Qty: {h.quantity} @ ₹{Number(h.buyPrice ?? h.avgPrice ?? 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-white font-mono">₹{Number(h.currentLTP || 0).toFixed(2)}</p>
                          <p className={`text-[11px] font-bold ${hIsProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {hIsProfit ? '+' : ''}{Number(h.pnl || 0).toFixed(2)} ({h.pnlPercent ? h.pnlPercent.toFixed(2) : '0.00'}%)
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
