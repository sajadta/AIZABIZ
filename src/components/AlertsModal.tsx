import React, { useState, useEffect, useRef } from 'react';
import { X, Bell, Trash2, Plus } from 'lucide-react';
import type { PriceAlert, Language } from '../types';

interface AlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceAlerts: PriceAlert[];
  onAddAlert: (
    symbol: string,
    instrumentKey: string,
    targetPrice: number,
    condition: 'GREATER_THAN' | 'LESS_THAN',
  ) => void;
  onRemoveAlert: (id: string) => void;
  language: Language;
}

export const AlertsModal: React.FC<AlertsModalProps> = ({
  isOpen,
  onClose,
  priceAlerts,
  onAddAlert,
  onRemoveAlert,
  language,
}) => {
  const [symbol, setSymbol] = useState('');
  const [instrumentKey, setInstrumentKey] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [condition, setCondition] = useState<'GREATER_THAN' | 'LESS_THAN'>('GREATER_THAN');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = () => {
    if (!symbol || !targetPrice) return;
    const price = parseFloat(targetPrice);
    if (isNaN(price)) return;
    const key = instrumentKey || `NSE_EQ|${symbol}`;
    onAddAlert(symbol.toUpperCase(), key, price, condition);
    setSymbol('');
    setInstrumentKey('');
    setTargetPrice('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-800 bg-slate-800/60 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Bell className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {language === 'ml' ? 'വില അലർട്ടുകൾ' : 'Price Alerts'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {language === 'ml'
                  ? 'ടാർഗെറ്റ് വിലയിലെത്തുമ്പോൾ നോട്ടിഫിക്കേഷൻ'
                  : 'Notify when price hits target'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-95 touch-manipulation"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={language === 'ml' ? 'സിംബൽ (ഉദാ: RELIANCE)' : 'Symbol (e.g. RELIANCE)'}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <input
                type="number"
                placeholder={language === 'ml' ? 'വില (₹)' : 'Target Price (₹)'}
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as PriceAlert['condition'])}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 flex-1"
              >
                <option value="GREATER_THAN">
                  {language === 'ml' ? 'വില കൂടുമ്പോൾ (>)' : 'Crosses Above (>)'}
                </option>
                <option value="LESS_THAN">
                  {language === 'ml' ? 'വില കുറയുമ്പോൾ (<)' : 'Crosses Below (<)'}
                </option>
              </select>

              <button
                onClick={handleAdd}
                disabled={!symbol || !targetPrice}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 min-h-[44px] rounded-lg text-sm font-bold transition flex items-center justify-center gap-1 active:scale-95 touch-manipulation"
              >
                <Plus className="w-4 h-4" />
                {language === 'ml' ? 'ചേർക്കുക' : 'Add'}
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
            {priceAlerts.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                {language === 'ml'
                  ? 'അലർട്ടുകൾ ഒന്നും സജ്ജമാക്കിയിട്ടില്ല.'
                  : 'No alerts configured.'}
              </div>
            ) : (
              priceAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-3 rounded-xl border ${alert.isActive ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-900/50 border-slate-800 opacity-60'}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{alert.symbol}</span>
                      {!alert.isActive && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 uppercase font-bold">
                          Triggered
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {alert.condition === 'GREATER_THAN' ? 'Above' : 'Below'}{' '}
                      <span className="font-mono text-indigo-400">₹{alert.targetPrice}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveAlert(alert.id)}
                    className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer with Big Easy-to-Tap Close Button */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-sm font-bold transition flex items-center justify-center gap-2 active:scale-95 touch-manipulation border border-slate-700"
          >
            <X className="w-4 h-4" />
            <span>{language === 'ml' ? 'അടയ്ക്കുക' : 'Close'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
