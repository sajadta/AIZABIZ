import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Lock, Unlock, AlertTriangle, KeyRound, CheckCircle2 } from 'lucide-react';
import type { Language } from '../types';
import { safeStorage } from '../utils/storage';

interface MasterPinLockModalProps {
  isLocked: boolean;
  onUnlock: () => void;
  language: Language;
}

/**
 * This is a convenience UI lock only; a PIN embedded in client code is not an authentication boundary.
 * Protect sensitive data and privileged operations on the server.
 */
const MASTER_PIN = '9847';

export const MasterPinLockModal: React.FC<MasterPinLockModalProps> = ({
  isLocked,
  onUnlock,
  language,
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLocked) return;
    setPin('');
    setErrorMsg(null);
  }, [isLocked]);

  useEffect(
    () => () => {
      if (resetTimeout.current) clearTimeout(resetTimeout.current);
    },
    [],
  );

  if (!isLocked) return null;

  const verifyPin = (enteredPin: string) => {
    if (enteredPin === MASTER_PIN) {
      if (rememberDevice) safeStorage.setItem('aizabiz_master_unlocked', 'true');
      onUnlock();
      return;
    }

    setShake(true);
    setErrorMsg(
      language === 'ml' ? 'തെറ്റായ പിൻ! വീണ്ടും ശ്രമിക്കുക.' : 'Incorrect PIN. Try again.',
    );
    if (resetTimeout.current) clearTimeout(resetTimeout.current);
    resetTimeout.current = setTimeout(() => {
      setShake(false);
      setPin('');
      resetTimeout.current = null;
    }, 700);
  };

  const handleKeyPress = (digit: string) => {
    if (!/^\d$/.test(digit) || pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMsg(null);
    if (nextPin.length === 4) verifyPin(nextPin);
  };

  const handleBackspace = () => {
    setPin((current) => current.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-[#05070e]/[0.97] backdrop-blur-sm flex flex-col items-center justify-center p-4 select-none">
      <div
        className={`w-full max-w-sm bg-[#0a0e1a] border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black flex flex-col items-center text-center space-y-6 transition-transform duration-200 ${
          shake ? 'animate-bounce text-rose-400' : ''
        }`}
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/50">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>AIZABIZ PRO</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {language === 'ml' ? 'തുടരാൻ പിൻ നൽകുക' : 'Enter your PIN to continue'}
          </p>
        </div>
        <div className="flex gap-3" aria-label={`${pin.length} of 4 PIN digits entered`}>
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={`h-3 w-3 rounded-full border ${index < pin.length ? 'bg-emerald-400 border-emerald-400' : 'border-slate-600'}`}
            />
          ))}
        </div>
        {errorMsg && (
          <p role="alert" className="text-sm text-rose-400">
            {errorMsg}
          </p>
        )}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="min-h-12 rounded-xl border border-slate-700 bg-slate-900 text-lg font-bold text-white hover:bg-slate-800"
              aria-label={`Enter ${digit}`}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="min-h-12 rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300"
          >
            {language === 'ml' ? 'മായ്ക്കുക' : 'Clear'}
          </button>
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="min-h-12 rounded-xl border border-slate-700 bg-slate-900 text-lg font-bold text-white hover:bg-slate-800"
            aria-label="Enter 0"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="min-h-12 rounded-xl border border-slate-700 bg-slate-900 text-slate-300"
            aria-label={language === 'ml' ? 'അവസാന അക്കം നീക്കുക' : 'Delete last digit'}
          >
            ⌫
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(event) => setRememberDevice(event.target.checked)}
          />
          {language === 'ml' ? 'ഈ ഉപകരണത്തിൽ ഓർമ്മിക്കുക' : 'Remember this device'}
        </label>
        <p className="text-[10px] text-slate-500">
          {language === 'ml'
            ? 'ഇത് സൗകര്യത്തിനുള്ള ലോക്ക് മാത്രമാണ്; യഥാർത്ഥ സുരക്ഷ സെർവറിൽ നടപ്പാക്കണം.'
            : 'This is a convenience lock only, not server-side authentication.'}
        </p>
        <div className="sr-only" aria-hidden="true">
          <Unlock />
          <AlertTriangle />
          <KeyRound />
          <CheckCircle2 />
        </div>
      </div>
    </div>
  );
};
