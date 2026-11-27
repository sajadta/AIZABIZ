import { useEffect } from 'react';

interface UseAppDataSyncOptions {
  activeTab: string;
  selectedSymbol: string;
  isConnected: boolean;
  accessToken?: string;
  geminiAnalysis: unknown;
  aiLoading: boolean;
  fetchOptionChain: (instrumentKey?: string, symbol?: string) => void;
  fetchHoldings: () => void;
  fetchLivePositions: () => void;
  handleFetchGeminiAnalysis: () => void;
}

/** Tab-driven data fetching, periodic holdings sync and AI tab auto-analysis. */
export function useAppDataSync({
  activeTab,
  selectedSymbol,
  isConnected,
  accessToken,
  geminiAnalysis,
  aiLoading,
  fetchOptionChain,
  fetchHoldings,
  fetchLivePositions,
  handleFetchGeminiAnalysis,
}: UseAppDataSyncOptions) {
  useEffect(() => {
    if (activeTab === 'OPTIONS') {
      fetchOptionChain(undefined, selectedSymbol);
    } else if (activeTab === 'HOLDINGS' || activeTab === 'ORDERS') {
      fetchHoldings();
      fetchLivePositions();
    }
  }, [activeTab, selectedSymbol, fetchOptionChain, fetchHoldings, fetchLivePositions]);

  // Initial and periodic sync of holdings (server holds token fallback)
  useEffect(() => {
    if (isConnected || accessToken) {
      fetchHoldings();
    }
  }, [isConnected, accessToken, fetchHoldings]);

  // Auto-load AI analysis when switching to the AI tab
  useEffect(() => {
    if (activeTab === 'AI' && !geminiAnalysis && !aiLoading) {
      handleFetchGeminiAnalysis();
    }
  }, [activeTab, geminiAnalysis, aiLoading, handleFetchGeminiAnalysis]);
}
