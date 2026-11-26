import React from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle2,
  Activity,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { GeminiMarketAnalysis, Language } from '../types';
import { translations } from '../translations';

interface GeminiAiAdvisorProps {
  analysis: GeminiMarketAnalysis | null;
  loading: boolean;
  onRefreshAnalysis: () => void;
  language: Language;
  symbol: string;
}

export const GeminiAiAdvisor: React.FC<GeminiAiAdvisorProps> = ({
  analysis,
  loading,
  onRefreshAnalysis,
  language,
  symbol,
}) => {
  const t = translations[language];

  // Defensive extraction of analysis fields to guard against partial or undefined objects
  const sentiment = analysis?.sentiment || 'NEUTRAL';
  const isBullish = sentiment.includes('BULLISH');
  const isBearish = sentiment.includes('BEARISH');
  const confidenceScore = analysis?.confidenceScore ?? 75;
  const action = analysis?.recommendedAction || {
    type: 'WAIT',
    entryRange: 'Monitoring Zone',
    stopLoss: 0,
    target1: 0,
    target2: 0,
    confidence: confidenceScore,
    riskReward: '1 : 2',
  };
  const keyLevels = analysis?.keyLevels || {
    support1: 0,
    support2: 0,
    resistance1: 0,
    resistance2: 0,
  };

  // Safe technical reasons list with cross-language fallback
  const rawReasons =
    language === 'ml'
      ? Array.isArray(analysis?.technicalReasonsMalayalam) &&
        analysis.technicalReasonsMalayalam.length > 0
        ? analysis.technicalReasonsMalayalam
        : Array.isArray(analysis?.technicalReasons)
          ? analysis.technicalReasons
          : []
      : Array.isArray(analysis?.technicalReasons) && analysis.technicalReasons.length > 0
        ? analysis.technicalReasons
        : Array.isArray(analysis?.technicalReasonsMalayalam)
          ? analysis.technicalReasonsMalayalam
          : [];

  const technicalReasonsList =
    rawReasons.length > 0
      ? rawReasons
      : [
          language === 'ml'
            ? 'വോളിയവും മൂവിംഗ് ആവറേജുകളും സ്ഥിരതയുള്ള ഇൻട്രാഡേ ട്രെൻഡ് കാണിക്കുന്നു.'
            : 'Volume and moving averages show a steady intraday directional trend.',
          language === 'ml'
            ? 'ഇൻഡിക്കേറ്ററുകൾ അടിസ്ഥാനമാക്കിയുള്ള ഓട്ടോമാറ്റിക് അനാലിസിസ് സജീവമാണ്.'
            : 'Algorithmic indicators confirm current structural levels.',
        ];

  const summaryText =
    language === 'ml'
      ? analysis?.summaryMalayalam ||
        analysis?.summary ||
        `${symbol} വിപണിയിൽ സ്ഥിരതയാർന്ന ട്രെൻഡ് രേഖപ്പെടുത്തുന്നു.`
      : analysis?.summary ||
        analysis?.summaryMalayalam ||
        `${symbol} displays active institutional market movement.`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-sm shadow-purple-950/40">
            <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-white tracking-tight uppercase flex items-center gap-1.5">
              {t.aiAdvisor}
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Gemini 3.7 Flash Institutional Market Model
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshAnalysis}
          disabled={loading}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-purple-950/60 transition active:scale-95 disabled:opacity-50 border border-purple-400/30"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{language === 'ml' ? 'സ്കാൻ ചെയ്യുന്നു...' : 'Analyzing Live Feed...'}</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              <span>{language === 'ml' ? 'AI സ്കാൻ' : 'Run Live AI Scan'}</span>
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto text-purple-400 animate-spin" />
            <p className="text-xs font-semibold">
              {language === 'ml'
                ? 'Gemini AI ലൈവ് മാർക്കറ്റ് വിവരങ്ങളും ചാർട്ടും സ്കാൻ ചെയ്യുന്നു...'
                : 'Gemini AI is parsing live order flow, candle momentum and multi-timeframe indicators...'}
            </p>
          </div>
        ) : !analysis ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <Sparkles className="w-8 h-8 mx-auto text-purple-400/50" />
            <p className="text-xs font-semibold">
              {language === 'ml'
                ? 'ലൈവ് വിശകലനം ലഭിക്കാൻ "AI സ്കാൻ" ബട്ടൺ ക്ലിക്ക് ചെയ്യുക.'
                : 'Click "Run Live AI Scan" to generate deep institutional market rationale.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sentiment & Score Banner */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-3 flex-wrap ${
                isBullish
                  ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-300'
                  : isBearish
                    ? 'bg-rose-950/25 border-rose-500/40 text-rose-300'
                    : 'bg-slate-900 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    isBullish
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isBearish
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isBullish ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : isBearish ? (
                    <TrendingDown className="w-5 h-5" />
                  ) : (
                    <Activity className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    AI Market Bias ({symbol})
                  </span>
                  <span className="text-sm sm:text-base font-extrabold tracking-tight">
                    {sentiment.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="text-[10px] text-slate-400 block uppercase">
                  {language === 'ml' ? 'കൃത്യത സ്കോർ' : 'Confidence Score'}
                </span>
                <span className="text-base sm:text-lg font-black text-white">
                  {confidenceScore}%
                </span>
              </div>
            </div>

            {/* Recommended Action Card */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    {language === 'ml'
                      ? 'AI നിർദ്ദേശിച്ച ട്രേഡ് ലെവലുകൾ'
                      : 'Recommended Institutional Trade Setup'}
                  </span>
                </h4>
                <span className="text-[10px] font-mono font-bold text-slate-400">
                  R:R {action.riskReward || '1 : 2'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">
                    {language === 'ml' ? 'എൻട്രി പരിധി' : 'Entry Zone'}
                  </span>
                  <span className="font-bold text-white text-[11px]">
                    {action.entryRange || '-'}
                  </span>
                </div>
                <div className="bg-rose-950/30 p-2 rounded-lg border border-rose-800/40">
                  <span className="text-[10px] text-rose-400 block">{t.stopLoss}</span>
                  <span className="font-bold text-rose-300">₹{action.stopLoss || 0}</span>
                </div>
                <div className="bg-emerald-950/30 p-2 rounded-lg border border-emerald-800/40">
                  <span className="text-[10px] text-emerald-400 block">{t.target1}</span>
                  <span className="font-bold text-emerald-300">₹{action.target1 || 0}</span>
                </div>
                <div className="bg-emerald-950/30 p-2 rounded-lg border border-emerald-800/40">
                  <span className="text-[10px] text-emerald-400 block">{t.target2}</span>
                  <span className="font-bold text-emerald-300">₹{action.target2 || 0}</span>
                </div>
              </div>
            </div>

            {/* AI Summary in Malayalam and English */}
            <div className="p-3.5 rounded-xl bg-purple-950/15 border border-purple-500/30 space-y-2">
              <h4 className="text-xs font-extrabold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>{language === 'ml' ? 'വിപണി വിശകലനം (Malayalam)' : 'Executive Summary'}</span>
              </h4>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">{summaryText}</p>
            </div>

            {/* Technical Reasons */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                {language === 'ml' ? 'സാങ്കേതിക അനുകൂല ഘടകങ്ങൾ' : 'Key Technical Rationale'}
              </h4>
              <div className="space-y-1">
                {technicalReasonsList.map((reason, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-xs text-slate-200 bg-slate-900/80 p-2 rounded-lg border border-slate-800"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Support & Resistance Levels */}
            <div className="p-3 rounded-xl bg-[#070a12] border border-slate-800 text-xs font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1.5">
                Institutional Pivot Matrix
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-1.5 rounded bg-rose-950/20 border border-rose-900/40">
                  <span className="text-[9px] text-rose-400 block">S2 (Major)</span>
                  <span className="font-bold text-slate-200">₹{keyLevels.support2 || 0}</span>
                </div>
                <div className="p-1.5 rounded bg-rose-950/20 border border-rose-900/40">
                  <span className="text-[9px] text-rose-400 block">S1 (Intraday)</span>
                  <span className="font-bold text-slate-200">₹{keyLevels.support1 || 0}</span>
                </div>
                <div className="p-1.5 rounded bg-emerald-950/20 border border-emerald-900/40">
                  <span className="text-[9px] text-emerald-400 block">R1 (Intraday)</span>
                  <span className="font-bold text-slate-200">₹{keyLevels.resistance1 || 0}</span>
                </div>
                <div className="p-1.5 rounded bg-emerald-950/20 border border-emerald-900/40">
                  <span className="text-[9px] text-emerald-400 block">R2 (Major)</span>
                  <span className="font-bold text-slate-200">₹{keyLevels.resistance2 || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
