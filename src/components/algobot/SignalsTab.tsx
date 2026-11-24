import React from 'react';
import { ShieldAlert, Sparkles, ArrowRight, Layers, Flame } from 'lucide-react';
import type {
  BotConfig,
  TradingSignal,
  Language,
  StockQuote,
  MultiIndexAlphaItem,
} from '../../types';
import type { Translations } from './types';
import { AlphaMatrix } from './signals/AlphaMatrix';
import { CorporateQuantShield } from './signals/CorporateQuantShield';
import { InstitutionalQuantMatrix } from './signals/InstitutionalQuantMatrix';
interface SignalsTabProps {
  t: Translations;
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  signals: TradingSignal[];
  language: Language;
  scanMessageIndex: number;
  multiIndexData: MultiIndexAlphaItem[];
  showIndexIntelligence: boolean;
  setShowIndexIntelligence: (v: boolean) => void;
  scanMessagesEn: string[];
  scanMessagesMl: string[];
  onExecuteSignal: (signal: TradingSignal) => void;
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
}
export const SignalsTab: React.FC<SignalsTabProps> = ({
  t,
  botConfig,
  onUpdateBotConfig,
  signals,
  language,
  scanMessageIndex,
  multiIndexData,
  showIndexIntelligence,
  setShowIndexIntelligence,
  scanMessagesEn,
  scanMessagesMl,
  onExecuteSignal,
  quotes,
  onSelectOptionTrade,
  onSelectSymbol,
  selectedSymbol,
}) => (
  <>
    <div className="space-y-3">
      {botConfig.enabled && (
        <div className="py-2.5 px-4 mb-3 text-center text-slate-200 bg-gradient-to-r from-emerald-950/20 via-[#0c1222] to-cyan-950/20 rounded-2xl border border-emerald-500/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(16,185,129,0.05)] flex items-center justify-center gap-2.5 transition-all duration-700">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <p className="text-xs font-bold tracking-wide text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
            {language === 'ml'
              ? scanMessagesMl[scanMessageIndex]
              : scanMessagesEn[scanMessageIndex]}
          </p>
        </div>
      )}
      <CorporateQuantShield language={language} />
      <AlphaMatrix
        botConfig={botConfig}
        onUpdateBotConfig={onUpdateBotConfig}
        signals={signals}
        language={language}
        multiIndexData={multiIndexData}
        showIndexIntelligence={showIndexIntelligence}
        setShowIndexIntelligence={setShowIndexIntelligence}
        quotes={quotes}
        onSelectOptionTrade={onSelectOptionTrade}
        onSelectSymbol={onSelectSymbol}
        selectedSymbol={selectedSymbol}
        onExecuteSignal={onExecuteSignal}
      />
      {signals.length === 0 && !botConfig.enabled ? (
        <div className="p-8 text-center text-slate-500">
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-semibold">
            {language === 'ml' ? 'ബോട്ട് ഓഫാണ്' : 'Bot is offline'}
          </p>
        </div>
      ) : (
        signals.map((sig) => (
          <div
            key={sig.id}
            className={`p-3.5 sm:p-4 rounded-2xl border transition-all backdrop-blur-md shadow-lg ${
              sig.signalType === 'BUY'
                ? 'bg-gradient-to-br from-emerald-950/25 via-slate-900/70 to-slate-950 border-emerald-500/30 hover:border-emerald-500/60 shadow-[0_4px_24px_rgba(16,185,129,0.08)]'
                : sig.signalType === 'SELL'
                  ? 'bg-gradient-to-br from-rose-950/25 via-slate-900/70 to-slate-950 border-rose-500/30 hover:border-rose-500/60 shadow-[0_4px_24px_rgba(244,63,94,0.08)]'
                  : 'bg-slate-900/40 border-slate-800/60'
            }`}
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-extrabold tracking-wider ${
                      sig.signalType === 'BUY'
                        ? 'bg-emerald-500 text-slate-950'
                        : sig.signalType === 'SELL'
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {sig.signalType === 'HOLD'
                      ? 'HOLD (WAITING)'
                      : sig.symbol.includes('CE') || sig.symbol.includes('PE')
                        ? 'BUY OPTION'
                        : sig.signalType}
                  </span>
                  <span className="text-sm font-extrabold text-white tracking-tight">
                    {sig.symbol}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{sig.timestamp}</span>
                  {/* MTF Confluence Badge */}
                  {sig.mtfConfirmation && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 ${
                        sig.mtfConfirmation.status
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Layers className="w-2.5 h-2.5" />
                      <span>
                        5m: {sig.mtfConfirmation.timeframe5m} | 15m:{' '}
                        {sig.mtfConfirmation.timeframe15m}
                      </span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-emerald-400/90 mt-1">
                  {sig.strategyName}
                </p>
              </div>
              {/* Confidence Score Pill */}
              <div className="text-right">
                <div className="text-xs font-mono font-extrabold text-emerald-400 flex items-center gap-1 justify-end">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>
                    {sig.confidenceScore}% {language === 'ml' ? 'കൃത്യത' : 'Confidence'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  R:R {sig.riskRewardRatio}
                </span>
              </div>
            </div>
            {/* Candlestick Pattern Recognition Card */}
            {sig.candlestickPattern && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/60 backdrop-blur-sm border border-cyan-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block">
                      {language === 'ml' ? 'കാൻഡിൽസ്റ്റിക്ക് പാറ്റേൺ' : 'Candlestick Pattern'}
                    </span>
                    <span className="font-extrabold text-cyan-300 text-[11px]">
                      {typeof sig.candlestickPattern === 'string'
                        ? language === 'ml' && sig.candlestickPatternMalayalam
                          ? sig.candlestickPatternMalayalam
                          : sig.candlestickPattern
                        : (sig.candlestickPattern as any).name || 'Pattern'}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {typeof sig.candlestickPattern === 'object'
                    ? (sig.candlestickPattern as any).type
                    : 'CONFIRMED'}
                </span>
              </div>
            )}
            {sig.institutionalQuantAnalysis && (
              <InstitutionalQuantMatrix
                analysis={sig.institutionalQuantAnalysis}
                language={language}
              />
            )}
            {/* Target & Stop Loss Levels (Unified Translucent Strip with Hairline Dividers) */}
            <div className="mt-2.5 p-2 rounded-xl bg-slate-950/50 backdrop-blur-sm border border-slate-800/60 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/60 text-xs font-mono">
              <div className="p-1.5 sm:px-3 text-left">
                <span className="text-[10px] text-slate-400 block font-sans">{t.entryPrice}</span>
                <span className="font-bold text-white text-[13px]">
                  {sig.price < 5000 ? `₹${sig.price}` : 'Market Price'}
                </span>
              </div>
              <div className="p-1.5 sm:px-3 text-left">
                <span className="text-[10px] text-rose-400/90 block font-sans">{t.stopLoss}</span>
                <span className="font-bold text-rose-300 text-[13px]">
                  {sig.stopLoss < 5000
                    ? `₹${sig.stopLoss}`
                    : `${sig.stopLoss > 10000 ? '-' : ''}₹${Math.abs(sig.stopLoss)}`}
                </span>
              </div>
              <div className="p-1.5 sm:px-3 text-left">
                <span className="text-[10px] text-emerald-400/90 block font-sans">
                  {t.target1} (T1)
                </span>
                <span className="font-bold text-emerald-300 text-[13px]">
                  {sig.target1 < 5000
                    ? `₹${sig.target1}`
                    : `${sig.target1 > 10000 ? '+' : ''}₹${Math.abs(sig.target1)}`}
                </span>
              </div>
              <div className="p-1.5 sm:px-3 text-left">
                <span className="text-[10px] text-emerald-400/90 block font-sans">
                  {t.target2} (T2)
                </span>
                <span className="font-bold text-emerald-300 text-[13px]">
                  {sig.target2 < 5000
                    ? `₹${sig.target2}`
                    : `${sig.target2 > 10000 ? '+' : ''}₹${Math.abs(sig.target2)}`}
                </span>
              </div>
            </div>
            {/* Option Strike Recommendation & Capital Affordability Pill */}
            {sig.recommendedOptionStrike && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-gradient-to-r from-indigo-950/50 via-slate-900 to-emerald-950/30 border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-300 flex items-center gap-1">
                      <span>
                        {language === 'ml'
                          ? '⚡ ഡ്യുവൽ-ലെയർ അനാലിസിസ് (Index Spot + Option Premium & Greeks)'
                          : '⚡ Dual-Layer Analysis (Index Spot + Option Premium & Greeks)'}
                      </span>
                    </span>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs font-black text-white font-mono bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/40">
                        BUY {sig.recommendedOptionStrike.strikePrice}{' '}
                        {sig.recommendedOptionStrike.optionType}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-400 font-mono">
                        Premium: ₹{sig.recommendedOptionStrike.ltp}
                      </span>
                      <span className="text-[10px] text-cyan-300 font-mono">
                        Δ {sig.recommendedOptionStrike.delta}
                      </span>
                      {sig.recommendedOptionStrike.iv !== undefined && (
                        <span className="text-[10px] text-amber-300 font-mono">
                          IV {Number(sig.recommendedOptionStrike.iv).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {sig.recommendedOptionStrike.lotSize && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                        1 Lot = {sig.recommendedOptionStrike.lotSize} Qty
                      </span>
                    )}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold font-mono">
                      {sig.recommendedOptionStrike.expiry}
                    </span>
                  </div>
                </div>
                {sig.recommendedOptionStrike.requiredCapital !== undefined && (
                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap text-[10px] font-mono">
                    <div className="flex items-center gap-2 flex-wrap text-slate-300">
                      <span>
                        {language === 'ml' ? '1 ലോട്ട് പ്രീമിയം:' : '1 Lot Premium:'}{' '}
                        <strong className="text-white">
                          ₹
                          {Number(sig.recommendedOptionStrike.requiredCapital).toLocaleString(
                            'en-IN',
                          )}
                        </strong>
                      </span>
                      {sig.recommendedOptionStrike.estimatedBrokerage !== undefined && (
                        <span className="text-amber-300">
                          + {language === 'ml' ? 'ബ്രോക്കറേജ് & ടാക്സ്:' : 'Brokerage & Taxes:'}{' '}
                          <strong>
                            ₹{Number(sig.recommendedOptionStrike.estimatedBrokerage).toFixed(0)}
                          </strong>
                        </span>
                      )}
                      {sig.recommendedOptionStrike.totalRequiredWithBrokerage !== undefined && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-bold">
                          {language === 'ml' ? 'ആകെ വേണ്ടത്:' : 'Total Cash Needed:'} ₹
                          {Number(
                            sig.recommendedOptionStrike.totalRequiredWithBrokerage,
                          ).toLocaleString('en-IN')}
                        </span>
                      )}
                      {sig.recommendedOptionStrike.expectedNetProfit !== undefined &&
                        sig.recommendedOptionStrike.expectedNetProfit > 0 && (
                          <span className="text-emerald-400 font-bold">
                            ({language === 'ml' ? 'അറ്റ ലാഭം:' : 'Est. Net Profit:'} +₹
                            {Number(sig.recommendedOptionStrike.expectedNetProfit).toFixed(0)})
                          </span>
                        )}
                    </div>
                    {sig.recommendedOptionStrike.affordableLots !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          sig.recommendedOptionStrike.affordableLots >= 1
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {sig.recommendedOptionStrike.affordableLots >= 1
                          ? language === 'ml'
                            ? `✅ ബ്രോക്കറേജ് ഉൾപ്പെടെ വാങ്ങാവുന്നത്: ${Math.min(5, sig.recommendedOptionStrike.affordableLots)} Lot`
                            : `✅ Fits Cash (Incl. Brokerage): ${Math.min(5, sig.recommendedOptionStrike.affordableLots)} Lot`
                          : language === 'ml'
                            ? `⚠️ അക്കൗണ്ടിൽ മതിയായ ലൈവ് ബാലൻസ് ഇല്ല (₹${Number(sig.recommendedOptionStrike.availableCapital || 0).toLocaleString('en-IN')})`
                            : `⚠️ Insufficient Live Cash (₹${Number(sig.recommendedOptionStrike.availableCapital || 0).toLocaleString('en-IN')})`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Rationale explanation */}
            <div className="mt-2.5 p-2 rounded-lg bg-[#070a12] border border-slate-800 text-[11px] text-slate-200">
              <span className="font-bold text-slate-400 mr-1">
                {language === 'ml' ? 'കാരണം:' : 'Algorithmic Rationale:'}
              </span>
              <span>{language === 'ml' ? sig.rationaleMalayalam : sig.rationale}</span>
            </div>
            {/* Execute Button */}
            <div className="mt-2.5 flex justify-end gap-2">
              <button
                onClick={() => onExecuteSignal(sig)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition active:scale-95 ${
                  sig.signalType === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
                }`}
              >
                <span>{language === 'ml' ? 'ഇപ്പോൾ ട്രേഡ് ചെയ്യുക' : 'Execute Signal Now'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </>
);
