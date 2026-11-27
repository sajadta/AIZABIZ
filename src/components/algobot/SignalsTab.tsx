import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type {
  BotConfig,
  TradingSignal,
  Language,
  StockQuote,
  MultiIndexAlphaItem,
} from '../../types';
import type { Translations } from './types';
import { AlphaMatrix } from './signals/AlphaMatrix';
import { CorporateQuantShield } from './signals/CorporateQuantShield';
import { SignalCard } from './signals/SignalCard';
interface SignalsTabProps {
  t: Translations;
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  signals: TradingSignal[];
  language: Language;
  scanMessageIndex: number;
  multiIndexData: MultiIndexAlphaItem[];
  showIndexIntelligence: boolean;
  setShowIndexIntelligence: (v: boolean) => void;
  scanMessagesEn: string[];
  scanMessagesMl: string[];
  onExecuteSignal: (signal: TradingSignal) => void;
  quotes: StockQuote[];
  onSelectOptionTrade?: (
    type: 'BUY' | 'SELL',
    optionSymbol: string,
    price: number,
    instrumentKey?: string,
    lotSize?: number,
  ) => void;
  onSelectSymbol?: (symbol: string, instrumentKey?: string) => void;
  selectedSymbol?: string;
}
export const SignalsTab: React.FC<SignalsTabProps> = ({
  t,
  botConfig,
  onUpdateBotConfig,
  signals,
  language,
  scanMessageIndex,
  multiIndexData,
  showIndexIntelligence,
  setShowIndexIntelligence,
  scanMessagesEn,
  scanMessagesMl,
  onExecuteSignal,
  quotes,
  onSelectOptionTrade,
  onSelectSymbol,
  selectedSymbol,
}) => (
  <>
    <div className="space-y-3">
      {botConfig.enabled && (
        <div className="py-2.5 px-4 mb-3 text-center text-slate-200 bg-gradient-to-r from-emerald-950/20 via-[#0c1222] to-cyan-950/20 rounded-2xl border border-emerald-500/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(16,185,129,0.05)] flex items-center justify-center gap-2.5 transition-all duration-700">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <p className="text-xs font-bold tracking-wide text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
            {language === 'ml'
              ? scanMessagesMl[scanMessageIndex]
              : scanMessagesEn[scanMessageIndex]}
          </p>
        </div>
      )}
      <CorporateQuantShield language={language} />
      <AlphaMatrix
        botConfig={botConfig}
        onUpdateBotConfig={onUpdateBotConfig}
        signals={signals}
        language={language}
        multiIndexData={multiIndexData}
        showIndexIntelligence={showIndexIntelligence}
        setShowIndexIntelligence={setShowIndexIntelligence}
        quotes={quotes}
        onSelectOptionTrade={onSelectOptionTrade}
        onSelectSymbol={onSelectSymbol}
        selectedSymbol={selectedSymbol}
        onExecuteSignal={onExecuteSignal}
      />
      {signals.length === 0 && !botConfig.enabled ? (
        <div className="p-8 text-center text-slate-500">
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-semibold">
            {language === 'ml' ? 'ബോട്ട് ഓഫാണ്' : 'Bot is offline'}
          </p>
        </div>
      ) : (
        signals.map((sig) => (
          <SignalCard
            key={sig.id}
            sig={sig}
            language={language}
            t={t}
            onExecuteSignal={onExecuteSignal}
          />
        ))
      )}
    </div>
  </>
);
