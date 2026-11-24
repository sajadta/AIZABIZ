import React from 'react';
import type { Language } from '../../types';

interface ConfirmDialogsProps {
  language: Language;
  isResetConfirmOpen: boolean;
  setIsResetConfirmOpen: (open: boolean) => void;
  confirmResetPaperAccount: () => void;
  isEquityExitConfirmOpen: boolean;
  setIsEquityExitConfirmOpen: (open: boolean) => void;
  confirmSquareOffEquityOnly: () => void;
}

export const AppConfirmDialogs: React.FC<ConfirmDialogsProps> = ({
  language,
  isResetConfirmOpen,
  setIsResetConfirmOpen,
  confirmResetPaperAccount,
  isEquityExitConfirmOpen,
  setIsEquityExitConfirmOpen,
  confirmSquareOffEquityOnly,
}) => (
  <>
    {isResetConfirmOpen && (
      <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-[#0b101d] border border-slate-800 p-5 shadow-2xl space-y-4">
          <h3 className="text-base font-black text-white">
            {language === 'ml'
              ? 'പേപ്പർ അക്കൗണ്ട് റീസെറ്റ് ചെയ്യണോ?'
              : 'Reset Paper Trading Account?'}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {language === 'ml'
              ? 'എല്ലാ പേപ്പർ ട്രേഡിംഗ് ഹിസ്റ്ററിയും ഓർഡറുകളും ക്ലിയർ ചെയ്ത് അക്കൗണ്ട് ബാലൻസ് ₹10,000 ആയി റീസെറ്റ് ചെയ്യും.'
              : 'This will clear all paper trading history and orders and reset your balance to ₹10,000.'}
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
            >
              {language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={confirmResetPaperAccount}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition"
            >
              {language === 'ml' ? 'റീസെറ്റ് ചെയ്യുക' : 'Reset to ₹10,000'}
            </button>
          </div>
        </div>
      </div>
    )}
    {isEquityExitConfirmOpen && (
      <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-[#0b101d] border border-slate-800 p-5 shadow-2xl space-y-4">
          <h3 className="text-base font-black text-white">
            {language === 'ml' ? 'ഇക്വിറ്റി ട്രേഡുകൾ എക്സിറ്റ് ചെയ്യണോ?' : 'Exit Equity Trades?'}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {language === 'ml'
              ? 'ഇന്നത്തെ എല്ലാ ഇക്വിറ്റി ട്രേഡുകളും എക്സിറ്റ് ചെയ്യണമെന്നുറപ്പാണോ? (ഹോൾഡിംഗുകൾ സുരക്ഷിതമായിരിക്കും)'
              : 'Are you sure you want to exit all equity trades? (Holdings will be kept untouched)'}
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEquityExitConfirmOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
            >
              {language === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={confirmSquareOffEquityOnly}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition"
            >
              {language === 'ml' ? 'എക്സിറ്റ് ചെയ്യുക' : 'Exit Equity'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
