import React from 'react';
import { BarChart2, Cpu, Layers, Briefcase, Sparkles } from 'lucide-react';
import type { BotConfig, Language, Position } from '../../types';
import type { TabKey } from './types';

interface AppMobileNavProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  botConfig: BotConfig;
  positions: Position[];
  language: Language;
}

export const AppMobileNav: React.FC<AppMobileNavProps> = ({
  activeTab,
  setActiveTab,
  botConfig,
  positions,
  language,
}) => (
  <>
    <nav className="lg:hidden shrink-0 w-full max-w-full min-w-0 bg-[#090d16] border-t border-slate-800 flex items-center justify-around px-1 py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-30 shadow-2xl">
      <button
        onClick={() => setActiveTab('WATCHLIST')}
        className={`min-h-[48px] min-w-[44px] flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition touch-manipulation select-none active:scale-95 ${
          activeTab === 'WATCHLIST'
            ? 'text-indigo-400 font-extrabold bg-indigo-500/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        aria-label={language === 'ml' ? 'വാച്ച്ലിസ്റ്റ്' : 'Watchlist'}
      >
        <Layers className="w-4 h-4 mb-0.5" />
        <span className="text-[10px] leading-tight truncate">
          {language === 'ml' ? 'വാച്ച്' : 'Watch'}
        </span>
      </button>

      <button
        onClick={() => setActiveTab('CHART')}
        className={`min-h-[48px] min-w-[44px] flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition touch-manipulation select-none active:scale-95 ${
          activeTab === 'CHART'
            ? 'text-indigo-400 font-extrabold bg-indigo-500/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        aria-label={language === 'ml' ? 'ചാർട്ട്' : 'Chart'}
      >
        <BarChart2 className="w-4 h-4 mb-0.5" />
        <span className="text-[10px] leading-tight truncate">
          {language === 'ml' ? 'ചാർട്ട്' : 'Chart'}
        </span>
      </button>

      <button
        onClick={() => setActiveTab('BOT')}
        className={`min-h-[48px] min-w-[44px] flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition touch-manipulation select-none active:scale-95 relative ${
          activeTab === 'BOT'
            ? 'text-indigo-400 font-extrabold bg-indigo-500/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        aria-label={language === 'ml' ? 'അൽഗോ ട്രേഡിംഗ് ബോട്ട്' : 'Algo Bot'}
      >
        <Cpu className="w-4 h-4 mb-0.5" />
        <span className="text-[10px] leading-tight truncate">
          {language === 'ml' ? 'അൽഗോ' : 'Bot'}
        </span>
        {botConfig.enabled && (
          <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </button>

      <button
        onClick={() => setActiveTab('OPTIONS')}
        className={`min-h-[48px] min-w-[44px] flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition touch-manipulation select-none active:scale-95 ${
          activeTab === 'OPTIONS'
            ? 'text-cyan-400 font-extrabold bg-cyan-500/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        aria-label={language === 'ml' ? 'ഓപ്ഷൻ ചെയിൻ' : 'Option Chain'}
      >
        <Layers className="w-4 h-4 mb-0.5 text-cyan-400" />
        <span className="text-[10px] leading-tight truncate">
          {language === 'ml' ? 'ഓപ്ഷൻ' : 'Options'}
        </span>
      </button>

      <button
        onClick={() => setActiveTab('ORDERS')}
        className={`min-h-[48px] min-w-[44px] flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition touch-manipulation select-none active:scale-95 relative ${
          activeTab === 'ORDERS'
            ? 'text-indigo-400 font-extrabold bg-indigo-500/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        aria-label={language === 'ml' ? 'ഓർഡറുകളും പൊസിഷനുകളും' : 'Orders & Positions'}
      >
        <Briefcase className="w-4 h-4 mb-0.5" />
        <span className="text-[10px] leading-tight truncate">
          {language === 'ml' ? 'ഓർഡർ' : 'Orders'}
        </span>
        {positions.length > 0 && (
          <span className="absolute top-1 right-1.5 px-1 rounded-full bg-emerald-500 text-slate-950 font-black text-[8px]">
            {positions.length}
          </span>
        )}
      </button>

      <button
        onClick={() => setActiveTab('AI')}
        className={`min-h-[48px] min-w-[44px] flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition touch-manipulation select-none active:scale-95 ${
          activeTab === 'AI'
            ? 'text-amber-400 font-extrabold bg-amber-500/10'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        aria-label={language === 'ml' ? 'AI മാർക്കറ്റ് അനാലിസിസ്' : 'AI Market Analysis'}
      >
        <Sparkles className="w-4 h-4 mb-0.5 text-amber-400" />
        <span className="text-[10px] leading-tight truncate">
          {language === 'ml' ? 'AI' : 'AI'}
        </span>
      </button>
    </nav>
  </>
);
