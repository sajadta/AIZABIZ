import React from 'react';
import { Key, X } from 'lucide-react';

import { useUpstoxApiModal } from './useUpstoxApiModal';
type Hook = ReturnType<typeof useUpstoxApiModal>;

interface UpstoxHeaderProps {
  onClose: Hook['onClose'];
  language: Hook['language'];
}

export const UpstoxModalHeader: React.FC<UpstoxHeaderProps> = ({ onClose, language }) => {
  return (
    <>
      {/* Header */}
      <div className="p-4 sm:p-5 bg-[#090d16] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 shadow-inner">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
              <span>
                {language === 'ml' ? 'പ്രതിദിന Upstox ടോക്കൺ മാനേജർ' : 'Upstox Daily Token Manager'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {language === 'ml'
                ? 'OTP മാത്രം നൽകുക — ബാക്കി എല്ലാം ഓട്ടോമാറ്റിക് (100% സുരക്ഷിതം)'
                : 'Enter OTP Only — 100% Automatic Upstox Live Connection'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </>
  );
};
