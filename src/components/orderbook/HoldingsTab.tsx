import React from 'react';
import {
  CheckCircle2,
  PieChart,
  Plus,
  RefreshCw,
  BarChart2,
  Check,
  Lock,
  Edit2,
  X,
} from 'lucide-react';
import type { Holding, Language } from '../../types';
import type { ViewChartFn } from './types';
import { HoldingsCard } from './HoldingsCard';
interface HoldingsTabProps {
  holdings: Holding[];
  language: Language;
  onViewChart?: ViewChartFn;
  editingHoldingSym: string | null;
  setEditingHoldingSym: (v: string | null) => void;
  customBuyPriceInput: string;
  setCustomBuyPriceInput: (v: string) => void;
  savingBuyPrice: boolean;
  buyPriceSaveMessage: string | null;
  handleSaveCustomBuyPrice: (symbol: string, isin?: string) => Promise<void>;
  totalHoldingsInvested: number;
  totalHoldingsValue: number;
  totalHoldingsPnL: number;
  totalHoldingsPnLPercent: number;
  onOpenOrderModal?: (
    type: 'BUY' | 'SELL',
    symbol: string,
    price: number,
    options?: {
      quantity?: number;
      heldQuantity?: number;
      productType?: 'INTRADAY' | 'DELIVERY';
      instrumentKey?: string;
    },
  ) => void;
  onRefreshHoldings?: () => void;
  isConnected?: boolean;
  onOpenApiModal?: () => void;
}
export const HoldingsTab: React.FC<HoldingsTabProps> = ({
  holdings,
  language,
  onViewChart,
  editingHoldingSym,
  setEditingHoldingSym,
  customBuyPriceInput,
  setCustomBuyPriceInput,
  savingBuyPrice,
  buyPriceSaveMessage,
  handleSaveCustomBuyPrice,
  totalHoldingsInvested,
  totalHoldingsValue,
  totalHoldingsPnL,
  totalHoldingsPnLPercent,
  onOpenOrderModal,
  onRefreshHoldings,
  isConnected,
  onOpenApiModal,
}) => (
  <>
    <div className="space-y-4">
      {/* Holdings Summary Portfolio Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/30 via-slate-900 to-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {language === 'ml' ? 'ഹോൾഡിങ്സ് പോർട്ട്ഫോളിയോ മൂല്യം' : 'Total Holdings Value'}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono text-white">
              ₹
              {totalHoldingsValue.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className={`text-xs font-bold font-mono ${totalHoldingsPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {totalHoldingsPnL >= 0 ? '+' : ''}₹{totalHoldingsPnL.toFixed(2)} (
              {totalHoldingsPnLPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">
              {language === 'ml' ? 'നിക്ഷേപിച്ചത്' : 'Invested'}
            </span>
            <span className="text-sm font-bold font-mono text-slate-200">
              ₹{totalHoldingsInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-[9px] uppercase font-bold text-slate-400 block">
              {language === 'ml' ? 'ആകെ ഓഹരികൾ' : 'Total Scrips'}
            </span>
            <span className="text-sm font-bold font-mono text-cyan-400">
              {holdings.length} Stocks
            </span>
          </div>
          {onRefreshHoldings && (
            <button
              onClick={onRefreshHoldings}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95 flex items-center gap-1.5 text-xs font-bold shadow-sm"
              title={
                language === 'ml'
                  ? 'Upstox പോർട്ട്ഫോളിയോ വീണ്ടും സിങ്ക് ചെയ്യുക'
                  : 'Re-sync Upstox Holdings'
              }
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">
                {language === 'ml' ? 'പോർട്ട്ഫോളിയോ സിങ്ക്' : 'Sync Holdings'}
              </span>
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
                  : "Please activate today's Upstox Access Token to load your Demat Holdings."
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
              <span>
                🔑 {language === 'ml' ? 'Upstox ടോക്കൺ കണക്റ്റ് ചെയ്യുക' : 'Connect Upstox Token'}
              </span>
            </button>
          )}
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-left text-xs max-w-lg mx-auto space-y-2">
            <p className="text-amber-400 font-bold flex items-center gap-1.5">
              <span>💡</span>
              <span>
                {language === 'ml'
                  ? 'ശ്രദ്ധിക്കുക (Important Notes):'
                  : 'Why are my holdings not showing?'}
              </span>
            </p>
            <ul className="list-disc list-inside text-slate-300 space-y-1 text-[11px]">
              <li>
                <strong>
                  {language === 'ml' ? 'Upstox ടോക്കൺ സ്റ്റാറ്റസ്:' : 'Upstox Token Status:'}
                </strong>{' '}
                {language === 'ml'
                  ? 'API Key & Secret മാത്രം സേവ് ചെയ്താൽ ഹോൾഡിങ്‌സ് വരില്ല; ഇന്നത്തെ Access Token ജനറേറ്റ് ചെയ്ത് "🟢 Upstox ലൈവ് കണക്റ്റഡ്" ആണെന്ന് ഉറപ്പാക്കുക.'
                  : "Saving API Key & Secret alone is not enough; generate today's Access Token so status turns Green."}
              </li>
              <li>
                <strong>
                  {language === 'ml'
                    ? 'ഇൻട്രാഡേ & ഓപ്ഷൻ ട്രേഡുകൾ:'
                    : 'Intraday & Option Positions:'}
                </strong>{' '}
                {language === 'ml'
                  ? 'ഓപ്ഷനുകളും ഇൻട്രാഡേ ട്രേഡുകളും "Active Positions" ടാബിലാണ് കാണിക്കുക.'
                  : 'Option contracts and intraday trades appear in the "Active Positions" tab.'}
              </li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {holdings.map((h, idx) => (
            <HoldingsCard
              key={idx}
              h={h}
              idx={idx}
              language={language}
              onViewChart={onViewChart}
              editingHoldingSym={editingHoldingSym}
              setEditingHoldingSym={setEditingHoldingSym}
              customBuyPriceInput={customBuyPriceInput}
              setCustomBuyPriceInput={setCustomBuyPriceInput}
              savingBuyPrice={savingBuyPrice}
              handleSaveCustomBuyPrice={handleSaveCustomBuyPrice}
              onOpenOrderModal={onOpenOrderModal}
            />
          ))}
        </div>
      )}
    </div>
  </>
);
