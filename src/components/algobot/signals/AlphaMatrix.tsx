// Multi-index alpha matrix: index-priority ribbon, intelligence drawer and the
// six-index radar cards with per-index trade verdicts.
import React from 'react';
import { ArrowRight, Flame, Layers, Lock, Sparkles, TrendingUp } from 'lucide-react';
import type {
  BotConfig,
  Language,
  MultiIndexAlphaItem,
  StockQuote,
  TradingSignal,
} from '../../../types';

interface AlphaMatrixProps {
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  signals: TradingSignal[];
  language: Language;
  multiIndexData: MultiIndexAlphaItem[];
  showIndexIntelligence: boolean;
  setShowIndexIntelligence: (v: boolean) => void;
  quotes: StockQuote[];
  onSelectOptionTrade?: (
    type: 'BUY' | 'SELL',
    optionSymbol: string,
    price: number,
    instrumentKey?: string,
    lotSize?: number,
  ) => void;
  onSelectSymbol?: (symbol: string, instrumentKey?: string) => void;
  selectedSymbol?: string;
  onExecuteSignal: (signal: TradingSignal) => void;
}

export const AlphaMatrix: React.FC<AlphaMatrixProps> = ({
  botConfig,
  onUpdateBotConfig,
  signals,
  language,
  multiIndexData,
  showIndexIntelligence,
  setShowIndexIntelligence,
  quotes,
  onSelectOptionTrade,
  onSelectSymbol,
  selectedSymbol,
  onExecuteSignal,
}) => (
  <>
  {/* Multi-Index Real-Time Alpha Opportunity Matrix (Integrated Design) */}
  <div className="p-4 rounded-2xl bg-slate-900/30 backdrop-blur-sm border border-slate-800/30 shadow-inner text-xs space-y-3 transition-all duration-500 hover:border-emerald-500/10">
    <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800/20">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-emerald-400/70" />
        <div>
          <span className="font-bold text-slate-100 text-xs block">
            {language === 'ml'
              ? '📊 സൂചികകൾ & ഓപ്ഷൻ പ്രീമിയം സെലക്ടർ'
              : '📊 Indices & Option Premium Selector'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowIndexIntelligence(!showIndexIntelligence)}
          className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-slate-800/40 hover:bg-slate-800 text-cyan-400/80 border border-slate-800 transition"
        >
          {language === 'ml' ? 'വിശദാംശങ്ങൾ' : 'Details'}
        </button>
        <span className="text-[9px] font-mono font-bold text-emerald-400/80 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
          <span>LIVE</span>
        </span>
      </div>
    </div>
    {/* Index Priority Mode Selector Buttons (Clean Flat Ribbon) */}
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span>{language === 'ml' ? 'ഇൻഡക്സ് ഫോക്കസ് മോഡ്:' : 'Index Focus Mode:'}</span>
        <span className="text-cyan-400 font-bold">
          {botConfig.selectedIndexPriority || 'FULL_AUTO_MULTI_INDEX'}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          {
            id: 'FULL_AUTO_MULTI_INDEX',
            labelMl: '⚡ ഓട്ടോ സ്കാനർ (എല്ലാം)',
            labelEn: '⚡ Full Auto (All 6)',
          },
          { id: 'NIFTY_50_ONLY', labelMl: 'NIFTY 50', labelEn: 'NIFTY 50' },
          { id: 'BANKNIFTY_ONLY', labelMl: 'BANKNIFTY', labelEn: 'BANKNIFTY' },
          { id: 'SENSEX_ONLY', labelMl: 'SENSEX', labelEn: 'SENSEX' },
          { id: 'FINNIFTY_ONLY', labelMl: 'FINNIFTY', labelEn: 'FINNIFTY' },
          { id: 'MIDCPNIFTY_ONLY', labelMl: 'MIDCPNIFTY', labelEn: 'MIDCPNIFTY' },
          { id: 'BANKEX_ONLY', labelMl: 'BANKEX', labelEn: 'BANKEX' },
        ].map((mode) => {
          const isSelected =
            (botConfig.selectedIndexPriority || 'FULL_AUTO_MULTI_INDEX') === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => {
                onUpdateBotConfig({
                  selectedIndexPriority: mode.id as any,
                });
                // Sync main chart if it's a specific index
                const symMap: Record<string, string> = {
                  NIFTY_50_ONLY: 'NIFTY 50',
                  BANKNIFTY_ONLY: 'BANKNIFTY',
                  SENSEX_ONLY: 'SENSEX',
                  FINNIFTY_ONLY: 'FINNIFTY',
                  MIDCPNIFTY_ONLY: 'MIDCPNIFTY',
                  BANKEX_ONLY: 'BANKEX',
                };
                if (symMap[mode.id]) {
                  if (onSelectSymbol) onSelectSymbol(symMap[mode.id]);
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                isSelected
                  ? 'bg-cyan-500 text-slate-950 shadow font-black'
                  : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/60'
              }`}
            >
              {language === 'ml' ? mode.labelMl : mode.labelEn}
            </button>
          );
        })}
      </div>
    </div>
    {/* Explanatory Intelligence Drawer */}
    {showIndexIntelligence && (
      <div className="p-3.5 rounded-xl bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-800/50 space-y-3 animate-in fade-in duration-200">
        <div className="flex items-center gap-2 text-cyan-300 font-black text-xs">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>
            {language === 'ml'
              ? 'ഇൻഡക്സ് ഓപ്ഷൻ പ്രീമിയം സെലക്ഷൻ അൽഗോരിതം വിശദീകരണം'
              : 'Institutional Index & Option Premium Selection Intelligence'}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px] text-slate-300">
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90 space-y-1.5">
            <span className="font-extrabold text-white text-xs block text-emerald-400">
              {language === 'ml'
                ? '1. ഏതൊക്കെ ഇൻഡക്സുകളാണ് ട്രേഡ് ചെയ്യുന്നത്?'
                : '1. Which Indices Are Traded?'}
            </span>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              {language === 'ml'
                ? 'ഇന്ത്യൻ മാർക്കറ്റിലെ 6 പ്രമുഖ ഇൻഡക്സുകളും പൂർണ്ണമായി സപ്പോർട്ട് ചെയ്യുന്നു:'
                : 'Full tick-by-tick real execution support for all 6 benchmark Indian indices:'}
            </p>
            <ul className="text-[10px] space-y-1 text-slate-300 list-disc list-inside">
              <li>
                <strong>NIFTY 50</strong> (NSE | Lot: 25 | Expiry: വ്യാഴം / Thu)
              </li>
              <li>
                <strong>BANKNIFTY</strong> (NSE | Lot: 15 | Expiry: ബുധൻ / Wed)
              </li>
              <li>
                <strong>SENSEX</strong> (BSE | Lot: 10 | Expiry: വെള്ളി / Fri)
              </li>
              <li>
                <strong>FINNIFTY</strong> (NSE | Lot: 25 | Expiry: ചൊവ്വ / Tue)
              </li>
              <li>
                <strong>MIDCPNIFTY</strong> (NSE | Lot: 50 | Expiry: തിങ്കൾ / Mon)
              </li>
              <li>
                <strong>BANKEX</strong> (BSE | Lot: 15 | Expiry: തിങ്കൾ / Mon)
              </li>
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/90 space-y-1.5">
            <span className="font-extrabold text-white text-xs block text-cyan-400">
              {language === 'ml'
                ? '2. എങ്ങനെയാണ് ഏറ്റവും ഉയർന്ന ലാഭമുള്ള ഓപ്ഷൻ പ്രീമിയം കണ്ടെത്തുന്നത്?'
                : '2. How Does Algo Find the Most Profitable Option Premium?'}
            </span>
            <ul className="text-[10px] space-y-1 text-slate-300 list-disc list-inside">
              <li>
                <strong>
                  {language === 'ml' ? 'മൾട്ടി-ടൈംഫ്രെയിം കൺഫ്ലുവെൻസ്:' : 'MTF Confluence:'}
                </strong>{' '}
                {language === 'ml'
                  ? '15m + 5m സ്ട്രക്ച്ചറും കോർപ്പറേറ്റ് ഫ്ലോയും തുല്യമായി ഒത്തുചേരുമ്പോൾ മാത്രം.'
                  : '15m + 5m trend and institutional heavyweights must agree.'}
              </li>
              <li>
                <strong>
                  {language === 'ml'
                    ? 'ഹൈ-ഗാമ ATM സ്വീറ്റ് സ്പോട്ട്:'
                    : 'High-Gamma ATM Sweet Spot:'}
                </strong>{' '}
                {language === 'ml'
                  ? 'ഡെൽറ്റ 0.45–0.62 ഉള്ള ATM/ITM ഓപ്ഷനുകൾ (ഡീപ് OTM തീറ്റ നഷ്ടം 0% ഒഴിവാക്കുന്നു).'
                  : 'ATM/ITM strikes with Delta 0.45–0.62 capture 100% gamma expansion.'}
              </li>
              <li>
                <strong>
                  {language === 'ml' ? '1m കാൻഡിൽ പ്രീമിയം വേഗത:' : '1m Option Momentum:'}
                </strong>{' '}
                {language === 'ml'
                  ? 'ഓപ്ഷൻ പ്രീമിയത്തിന്റെ കാൻഡിൽ പച്ചയായി മുകളിലേക്ക് കുതിക്കുന്നുണ്ടെന്ന് ഉറപ്പാക്കുന്നു.'
                  : 'Option candle itself must be green and expanding upward.'}
              </li>
              <li>
                <strong>
                  {language === 'ml'
                    ? 'ബ്രോക്കറേജ് പ്രൊട്ടക്ഷൻ ഷീൽഡ്:'
                    : 'Anti-Brokerage Protection:'}
                </strong>{' '}
                {language === 'ml'
                  ? '₹40 ബ്രോക്കറേജ് കഴിഞ്ഞ് മിനിമം +₹350 മുതൽ +₹1,500 വരെ അറ്റാദായം ഉറപ്പുള്ളത് മാത്രം.'
                  : 'Requires net profit buffer (+₹350–₹1,500) above all roundtrip brokerage & taxes.'}
              </li>
            </ul>
          </div>
        </div>
      </div>
    )}
    {/* 6-Index Real-Time Alpha Radar Cards */}
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-2.5 text-[10px] font-mono">
      {[
        { name: 'NIFTY 50', key: 'NSE_INDEX|Nifty 50', exch: 'NSE', lot: 65, exp: 'Thu' },
        { name: 'BANKNIFTY', key: 'NSE_INDEX|Nifty Bank', exch: 'NSE', lot: 30, exp: 'Wed' },
        { name: 'SENSEX', key: 'BSE_INDEX|SENSEX', exch: 'BSE', lot: 20, exp: 'Fri' },
        {
          name: 'FINNIFTY',
          key: 'NSE_INDEX|Nifty Fin Service',
          exch: 'NSE',
          lot: 60,
          exp: 'Tue',
        },
        {
          name: 'MIDCPNIFTY',
          key: 'NSE_INDEX|NIFTY MID SELECT',
          exch: 'NSE',
          lot: 120,
          exp: 'Mon',
        },
        { name: 'BANKEX', key: 'BSE_INDEX|BANKEX', exch: 'BSE', lot: 30, exp: 'Mon' },
      ].map((item, idx) => {
        const matrixItem = multiIndexData.find(
          (m) => m.key === item.key || m.symbol.toUpperCase().includes(item.name.split(' ')[0]),
        );
        const matchingSig = signals.find(
          (s) =>
            s.underlyingInstrumentKey === item.key ||
            s.symbol.toUpperCase().includes(item.name.split(' ')[0]),
        );
        const matchingQuote = quotes.find(
          (q) =>
            q.symbol.toUpperCase().includes(item.name.split(' ')[0]) ||
            q.instrumentKey === item.key,
        );
        const ltp = matrixItem?.spotLtp || matchingQuote?.ltp || 0;
        const ltpDisplay = ltp > 0 ? `₹${ltp.toLocaleString('en-IN')}` : '--';
        const trend15 =
          matrixItem?.trend15m || matchingSig?.mtfConfirmation?.timeframe15m || 'NEUTRAL';
        const signalType = matrixItem?.signalType || matchingSig?.signalType || 'HOLD';
        const isHold = signalType === 'HOLD';
        const isCall = signalType === 'BUY';
        const isPut = signalType === 'SELL';
        const isSelected = item.name === selectedSymbol;
        const isTopPickNow =
          !!matrixItem?.isTopPick &&
          botConfig.selectedIndexPriority === 'FULL_AUTO_MULTI_INDEX';
        const optSymbol = matrixItem?.bestOptionSymbol || matchingSig?.symbol || '--';
        const optLtp =
          matrixItem?.bestOptionLtp || (matchingSig?.price ? Number(matchingSig.price) : 0);
        const expNet = matrixItem?.expectedNetProfit || 0;
        const delta = matrixItem?.delta || matchingSig?.recommendedOptionStrike?.delta || 0;
        return (
          <div
            key={item.name}
            onClick={() => onSelectSymbol && onSelectSymbol(item.name, item.key)}
            className={`p-3.5 rounded-2xl flex flex-col justify-between gap-3 transition-all duration-500 backdrop-blur-md relative overflow-hidden group cursor-pointer border ${
              isSelected
                ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
                : isTopPickNow && !selectedSymbol
                  ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30 scale-[1.01]'
                  : 'bg-slate-900/60 border-slate-800/60 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.1)]'
            }`}
          >
            {(isTopPickNow || isSelected) && (
              <div
                className={`absolute top-0 left-0 w-full h-[1.5px] bg-gradient-to-r from-transparent ${isSelected ? 'via-cyan-400' : 'via-emerald-400'} to-transparent`}
              ></div>
            )}
            <div className="flex items-center justify-between gap-1">
              <div>
                <span
                  className={`font-black text-[13px] tracking-tight block ${isSelected ? 'text-cyan-300' : 'text-white'}`}
                >
                  {item.name}
                </span>
                <span className="text-[9px] text-slate-500 font-sans font-bold uppercase tracking-tighter block mt-0.5">
                  {item.exch} • LOT: {matrixItem?.lotSize || item.lot}
                </span>
              </div>
              {isTopPickNow ? (
                <div className="flex flex-col items-end">
                  <span
                    className={`px-2 py-0.5 rounded text-[8px] font-black ${isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500 text-slate-950'} shadow-[0_0_8px_rgba(16,185,129,0.4)]`}
                  >
                    {isSelected ? 'SELECTED' : 'ALPHA #1'}
                  </span>
                </div>
              ) : isSelected ? (
                <span className="px-2 py-0.5 rounded text-[8px] font-black bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                  ACTIVE
                </span>
              ) : (
                <span className="text-[10px] font-black text-slate-600 font-mono">
                  0{matrixItem?.rank || idx + 1}
                </span>
              )}
            </div>
            <div className="flex items-baseline justify-between py-1 border-b border-slate-800/30">
              <span className="text-slate-100 font-mono text-[12px] font-black tracking-tighter">
                {ltpDisplay}
              </span>
              <span
                className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                  trend15 === 'BULLISH'
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : trend15 === 'BEARISH'
                      ? 'text-rose-400 bg-rose-500/10'
                      : 'text-amber-400 bg-amber-500/10'
                }`}
              >
                {trend15}
              </span>
            </div>
            {/* Best Option Strike & Profit Potential (Flat Hairline Separator) */}
            <div
              onClick={() => {
                if (optSymbol !== '--' && optLtp > 0 && onSelectOptionTrade) {
                  onSelectOptionTrade(
                    isPut ? 'BUY' : 'BUY',
                    optSymbol,
                    optLtp,
                    matrixItem?.key || item.key,
                    matrixItem?.lotSize || item.lot,
                  );
                }
              }}
              className={`py-1.5 px-1 border-t border-b border-slate-800/50 space-y-1 transition active:scale-95 ${
                optSymbol !== '--' && optLtp > 0 ? 'cursor-pointer hover:bg-slate-800/30' : ''
              }`}
            >
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-cyan-300 font-bold truncate max-w-[90px]">
                  {optSymbol !== '--'
                    ? optSymbol.replace('NSE_FO|', '').replace('BSE_FO|', '')
                    : 'Option Strike'}
                </span>
                <span className="font-bold text-white">
                  {optLtp > 0 ? `₹${optLtp.toFixed(1)}` : '--'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[8px] font-mono">
                <span className="text-slate-400">Δ: {delta ? delta.toFixed(2) : '0.50'}</span>
                {expNet > 0 ? (
                  <span className="text-emerald-400 font-bold">
                    +₹{Math.round(expNet).toLocaleString('en-IN')} Net
                  </span>
                ) : (
                  <span className="text-slate-500">Wait breakout</span>
                )}
              </div>
            </div>
            {/* Action Verdict Button */}
            <div className="pt-0.5 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => {
                  if (matchingSig) {
                    onExecuteSignal(matchingSig);
                  } else if (onSelectOptionTrade && optSymbol !== '--' && optLtp > 0) {
                    onSelectOptionTrade(
                      isPut ? 'BUY' : 'BUY',
                      optSymbol,
                      optLtp,
                      matrixItem?.key || item.key,
                      matrixItem?.lotSize || item.lot,
                    );
                  }
                }}
                className={`w-full text-center py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition active:scale-95 shadow ${
                  isHold
                    ? 'bg-slate-800/80 text-slate-400 border border-slate-700/50 hover:bg-slate-700'
                    : isCall
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-md shadow-emerald-900/50'
                      : 'bg-rose-500 hover:bg-rose-400 text-white font-black shadow-md shadow-rose-900/50'
                }`}
              >
                {isHold
                  ? optSymbol !== '--' && optLtp > 0
                    ? `TRADE ${item.name}`
                    : 'HOLD (Wait)'
                  : isCall
                    ? 'BUY CALL (CE)'
                    : 'BUY PUT (PE)'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </div>
  </>
);
