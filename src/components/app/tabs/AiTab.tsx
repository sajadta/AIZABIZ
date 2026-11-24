import React from 'react';
import { ErrorBoundary } from '../../ErrorBoundary';
import { GeminiAiAdvisor } from '../../GeminiAiAdvisor';
import { LiveAiSupport } from '../../LiveAiSupport';
import type { GeminiMarketAnalysis, Language, StockQuote, UpstoxApiConfig } from '../../../types';

interface AiTabProps {
  quotes: StockQuote[];
  selectedSymbol: string;
  language: Language;
  handleFetchGeminiAnalysis: () => Promise<void>;
  aiLoading: boolean;
  apiConfig: UpstoxApiConfig;
  geminiAnalysis: GeminiMarketAnalysis | null;
}

export const AiTab: React.FC<AiTabProps> = ({
  quotes,
  selectedSymbol,
  language,
  handleFetchGeminiAnalysis,
  aiLoading,
  apiConfig,
  geminiAnalysis,
}) => (
  <div className="h-full w-full max-w-full min-w-0 overflow-y-auto smooth-scroll grid grid-cols-1 lg:grid-cols-2 gap-4 pb-28 lg:pb-4">
    <ErrorBoundary fallbackTitle="AI മാർക്കറ്റ് അഡ്വൈസർ ലോഡ് ചെയ്യുന്നതിൽ പിശക് (AI Advisor Error)">
      <GeminiAiAdvisor
        analysis={geminiAnalysis}
        loading={aiLoading}
        onRefreshAnalysis={handleFetchGeminiAnalysis}
        language={language}
        symbol={selectedSymbol}
      />
    </ErrorBoundary>
    <ErrorBoundary fallbackTitle="ലൈവ് AI സപ്പോർട്ട് ലോഡ് ചെയ്യുന്നതിൽ പിശക് (Live AI Support Error)">
      <LiveAiSupport apiConfig={apiConfig} quotesCount={quotes.length} />
    </ErrorBoundary>
  </div>
);
