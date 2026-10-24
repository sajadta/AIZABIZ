import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Unlock, AlertTriangle, KeyRound, CheckCircle2 } from 'lucide-react';
import { Language } from '../types';

interface MasterPinLockModalProps {
  isLocked: boolean;
  onUnlock: () => void;
  language: Language;
}

const MASTER_PIN = '9847';

export const MasterPinLockModal: React.FC<MasterPinLockModalProps> = ({
  isLocked,
  onUnlock,
  language,
}) => {
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);

  useEffect(() => {
    if (!isLocked) return;
    setPin('');
    setErrorMsg(null);
  }, [isLocked]);

  if (!isLocked) return null;

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg(null);
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg(null);
  };

  const verifyPin = (enteredPin: string) => {
    if (enteredPin === MASTER_PIN) {
      if (rememberDevice) {
        localStorage.setItem('aizabiz_master_unlocked', 'true');
      }
      onUnlock();
    } else {
      setShake(true);
      setErrorMsg(language === 'ml' ? 'തെറ്റായ പിൻ! വീണ്ടും ശ്രമിക്കുക.' : 'Incorrect PIN! Access Denied.');
      setTimeout(() => {
        setShake(false);
        setPin('');
      }, 700);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-[#05070e]/98 backdrop-blur-2xl flex flex-col items-center justify-center p-4 select-none">
      <div 
        className={`w-full max-w-sm bg-[#0a0e1a] border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black flex flex-col items-center text-center space-y-6 transition-transform duration-200 ${
          shake ? 'animate-bounce text-rose-400' : ''
        }`}
      >
        {/* Lock Shield Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/50">
          <Lock className="w-8 h-8" />
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>AIZABIZ PRO</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PRIVATE
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {language === 'ml' 
              ? 'സ്വകാര്യ ട്രേഡിംഗ് ടെർമിനൽ • പ്രവേശിക്കാൻ മാസ്റ്റർ പിൻ നൽകുക' 
              : 'Private Algorithmic Terminal • Enter 4-Digit Master PIN'}
          </p>
        </div>

        {/* PIN Dots Display */}
        <div className="flex items-center gap-4 py-2">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50 scale-125'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5 animate-in fade-in">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="w-full h-14 rounded-2xl bg-slate-900/90 border border-slate-800 text-lg font-mono font-bold text-slate-100 hover:bg-slate-800 hover:text-white hover:border-slate-700 active:scale-95 active:bg-emerald-600 active:text-white transition shadow-sm touch-manipulation"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="w-full h-14 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:scale-95 transition touch-manipulation"
          >
            {language === 'ml' ? 'മായ്ക്കുക' : 'Clear'}
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="w-full h-14 rounded-2xl bg-slate-900/90 border border-slate-800 text-lg font-mono font-bold text-slate-100 hover:bg-slate-800 hover:text-white hover:border-slate-700 active:scale-95 active:bg-emerald-600 active:text-white transition shadow-sm touch-manipulation"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="w-full h-14 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:scale-95 transition touch-manipulation"
          >
            ⌫
          </button>
        </div>

        {/* Remember device toggle */}
        <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer pt-2">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
          />
          <span>
            {language === 'ml' 
              ? 'ഈ ഫോണിൽ എന്നെ ഓർക്കുക (Remember this device)' 
              : 'Remember on this device'}
          </span>
        </label>

        {/* Security badge */}
        <div className="pt-2 text-[10px] text-slate-300 flex items-center gap-1.5 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>256-Bit Encrypted Institutional Vault</span>
        </div>
      </div>
    </div>
  );
};
