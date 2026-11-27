import React from 'react';
import { Briefcase, Clock, Sparkles, CheckCheck } from 'lucide-react';
import type { Order, Position, Language } from '../../types';
import type { ViewChartFn } from './types';
import { PairedTradeCard } from './PairedTradeCard';
import { OrderRow } from './OrderRow';
interface OrdersTabProps {
  positions: Position[];
  orders: Order[];
  tradeHistory: Position[];
  language: Language;
  onViewChart?: ViewChartFn;
  newlyAddedIds: Set<string>;
  ordersViewMode: 'PAIRED' | 'INDIVIDUAL';
  setOrdersViewMode: (v: 'PAIRED' | 'INDIVIDUAL') => void;
}
export const OrdersTab: React.FC<OrdersTabProps> = ({
  positions,
  orders,
  tradeHistory,
  language,
  onViewChart,
  newlyAddedIds,
  ordersViewMode,
  setOrdersViewMode,
}) => (
  <>
    <div className="space-y-3">
      {/* ORDERS VIEW MODE TOGGLE & EXPLANATION BANNER */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>
              {language === 'ml'
                ? 'ബ്രോക്കർ ഓർഡർ ബുക്ക് & റൗണ്ട്-ട്രിപ്പ്'
                : 'Broker Order Book & Round-Trips'}
            </span>
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
              {language === 'ml'
                ? 'പൂർത്തിയായ റൗണ്ട്-ട്രിപ്പ് ട്രേഡുകൾ ഒന്നുമില്ല.'
                : 'No completed round-trip trades recorded.'}
            </p>
          </div>
        ) : (
          tradeHistory.map((pos) => {
            return (
              <PairedTradeCard
                key={`paired_${pos.id}`}
                pos={pos}
                language={language}
                onViewChart={onViewChart}
              />
            );
          })
        )
      ) : /* INDIVIDUAL ORDERS VIEW */
      orders.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
          <Clock className="w-8 h-8 mx-auto mb-2 text-slate-700" />
          <p className="text-xs font-semibold">
            {language === 'ml'
              ? 'ഇതുവരെ ഓർഡറുകൾ ഒന്നും നൽകിയിട്ടില്ല (മാർക്കറ്റ് സമയം 09:18 AM മുതൽ അൽഗോരിതം ട്രേഡ് എടുക്കും).'
              : 'No orders recorded in this session (Algo takes entries after 09:18 AM IST).'}
          </p>
        </div>
      ) : (
        orders.map((ord) => {
          return (
            <OrderRow
              key={ord.id}
              ord={ord}
              positions={positions}
              tradeHistory={tradeHistory}
              language={language}
              newlyAddedIds={newlyAddedIds}
              onViewChart={onViewChart}
            />
          );
        })
      )}
    </div>
  </>
);
