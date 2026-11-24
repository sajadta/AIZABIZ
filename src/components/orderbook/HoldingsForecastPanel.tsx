// Algorithmic forecast panel for a delivery holding.
import React from 'react';
import type { Holding, Language } from '../../types';

interface HoldingsForecastPanelProps {
  forecast: NonNullable<Holding['algoForecast']>;
  language: Language;
}

export const HoldingsForecastPanel: React.FC<HoldingsForecastPanelProps> = ({
  forecast,
  language,
}) => (
  <>
    {/* Pre-Cognitive 8-Layer & 5-Year Historical Algorithmic Forecast for Holding */}
    {forecast && (
      <div
        className={`p-2.5 rounded-lg border text-[11px] flex flex-col gap-1.5 ${
          forecast.direction === 'STRONG_UPTREND' || forecast.direction === 'UPTREND'
            ? 'bg-emerald-950/25 border-emerald-500/35 text-emerald-200'
            : forecast.direction === 'DOWNTREND_RISK'
              ? 'bg-rose-950/25 border-rose-500/35 text-rose-200'
              : 'bg-cyan-950/25 border-cyan-500/35 text-cyan-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-extrabold flex items-center gap-1.5 text-xs">
            🧠{' '}
            {language === 'ml'
              ? 'അൽഗോരിതം മുൻകൂട്ടി കാണുന്ന പ്രവചനം (Algo Forecast):'
              : 'Pre-Cognitive Algo Forecast:'}
          </span>
          <span className="px-2 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-[10px] font-bold">
            Confidence: {forecast.confidencePct}% | +50% Hit Prob:{' '}
            {forecast.fiftyPctReachProbability}%
          </span>
        </div>
        <p className="text-[11px] leading-relaxed font-medium text-slate-200">
          {forecast.forecastSummaryMl}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/10 text-[10px] font-mono text-slate-300">
          <div>
            <span className="text-slate-400 block">30D Algo Target:</span>
            <strong className="text-emerald-300">₹{forecast.expectedTarget30d.toFixed(2)}</strong>
          </div>
          <div>
            <span className="text-slate-400 block">Support / Resist:</span>
            <strong className="text-cyan-300">
              ₹{forecast.supportLevel} / ₹{forecast.resistanceLevel}
            </strong>
          </div>
          <div>
            <span className="text-slate-400 block">20D / 50D EMA:</span>
            <strong className="text-slate-200">
              ₹{forecast.ema20} / ₹{forecast.ema50}
            </strong>
          </div>
          <div>
            <span className="text-slate-400 block">14D RSI & Action:</span>
            <strong className="text-amber-300">
              RSI {forecast.rsi14} · {forecast.recommendedAction.replace(/_/g, ' ')}
            </strong>
          </div>
        </div>
      </div>
    )}
  </>
);
