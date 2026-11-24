// Inline editor that lets the user override and lock the actual buy price.
import React from 'react';
import { Check, Lock, RefreshCw, X } from 'lucide-react';
import type { Holding, Language } from '../../types';

interface HoldingsBuyPriceEditorProps {
  h: Holding;
  language: Language;
  avgPx: number;
  customBuyPriceInput: string;
  setCustomBuyPriceInput: (v: string) => void;
  savingBuyPrice: boolean;
  handleSaveCustomBuyPrice: (symbol: string, isin?: string) => void;
  setEditingHoldingSym: (v: string | null) => void;
}

export const HoldingsBuyPriceEditor: React.FC<HoldingsBuyPriceEditorProps> = ({
  h,
  language,
  avgPx,
  customBuyPriceInput,
  setCustomBuyPriceInput,
  savingBuyPrice,
  handleSaveCustomBuyPrice,
  setEditingHoldingSym,
}) => (
  <>
    <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/40 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-cyan-300 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          {language === 'ml'
            ? `${h.symbol} വാങ്ങിയ യഥാർത്ഥ വില നിശ്ചയിക്കുക:`
            : `Set Exact Buy Price for ${h.symbol}:`}
        </span>
        <button
          type="button"
          onClick={() => setEditingHoldingSym(null)}
          className="text-slate-400 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[11px] text-slate-300">
        {language === 'ml'
          ? 'ബ്രോക്കർ നൽകിയ വില ശരിയല്ലെങ്കിൽ (ഉദാ: Upstox 0 നൽകുകയോ മുൻദിന ക്ലോസിങ് വില കാണിക്കുകയോ ചെയ്താൽ), നിങ്ങളുടെ യഥാർത്ഥ വാങ്ങിയ വില ഇവിടെ നൽകി സ്ഥിരപ്പെടുത്താം (ലോക്ക്).'
          : 'If broker returns 0 or closing price, enter your actual acquisition price here to lock it permanently across restarts.'}
      </p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
            ₹
          </span>
          <input
            type="number"
            step="0.05"
            min="0.05"
            value={customBuyPriceInput}
            onChange={(e) => setCustomBuyPriceInput(e.target.value)}
            placeholder={avgPx > 0 ? String(avgPx) : '10.50'}
            className="w-full pl-6 pr-3 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/50 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
          />
        </div>
        <button
          type="button"
          disabled={savingBuyPrice || !customBuyPriceInput || parseFloat(customBuyPriceInput) <= 0}
          onClick={() => handleSaveCustomBuyPrice(h.symbol, h.isin)}
          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 shadow-sm"
        >
          {savingBuyPrice ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          <span>{language === 'ml' ? 'സ്ഥിരപ്പെടുത്തുക' : 'Save & Lock'}</span>
        </button>
      </div>
    </div>
  </>
);
