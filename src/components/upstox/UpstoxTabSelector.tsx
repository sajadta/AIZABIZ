import React from 'react';
import { Key, Zap } from 'lucide-react';

import { useUpstoxApiModal } from './useUpstoxApiModal';
type Hook = ReturnType<typeof useUpstoxApiModal>;

interface UpstoxTabSelectorProps {
  activeTab: Hook['activeTab'];
  setActiveTab: Hook['setActiveTab'];
  language: Hook['language'];
}

export const UpstoxTabSelector: React.FC<UpstoxTabSelectorProps> = ({
  activeTab,
  setActiveTab,
  language,
}) => {
  return (
    <>
      {/* 2-Tab Selection */}
      <div className="grid grid-cols-2 p-2 bg-[#0a0f1b] border-b border-slate-800 text-xs font-bold gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('DAILY_TOKEN')}
          className={`py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'DAILY_TOKEN'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-300" />
          <span>{language === 'ml' ? '☀️ ഡെയിലി ടോക്കൺ പേസ്റ്റ്' : '☀️ Daily Token Paste'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('API_KEYS')}
          className={`py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'API_KEYS'
              ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-blue-950'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
          }`}
        >
          <Key className="w-4 h-4 text-indigo-300" />
          <span>{language === 'ml' ? '🔑 OTP & ഓട്ടോ കണക്റ്റ്' : '🔑 OTP & Auto Connect'}</span>
        </button>
      </div>
    </>
  );
};
