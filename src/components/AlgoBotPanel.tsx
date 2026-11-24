import React, { useState, useEffect, useRef } from 'react';
import {
  BotConfig,
  BotLog,
  TradingSignal,
  Language,
  OptionChainData,
  StockQuote,
  Position,
  MultiIndexAlphaItem,
} from '../types';
import { translations } from '../translations';

import { AlgoBotHeader } from './algobot/AlgoBotHeader';
import { AlgoBotTabs } from './algobot/AlgoBotTabs';
import { SignalsTab } from './algobot/SignalsTab';
import { AiSupervisorTab } from './algobot/AiSupervisorTab';
import { InstitutionalTab } from './algobot/InstitutionalTab';
import { SettingsTab } from './algobot/SettingsTab';
import { BacktestTab } from './algobot/BacktestTab';
import { TelegramTab } from './algobot/TelegramTab';
import { LogsTab } from './algobot/LogsTab';

interface AlgoBotPanelProps {
  botConfig: BotConfig;
  onUpdateBotConfig: (config: Partial<BotConfig>) => void;
  botLogs: BotLog[];
  signals: TradingSignal[];
  language: Language;
  onExecuteSignal: (signal: TradingSignal) => void;
  optionChainData?: OptionChainData | null;
  quotes?: StockQuote[];
  tradeHistory?: Position[];
  activeSignal?: TradingSignal | null;
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

export const AlgoBotPanel: React.FC<AlgoBotPanelProps> = ({
  botConfig,
  onUpdateBotConfig,
  botLogs,
  signals,
  language,
  onExecuteSignal,
  optionChainData = null,
  quotes = [],
  tradeHistory = [],
  activeSignal = null,
  onSelectOptionTrade,
  onSelectSymbol,
  selectedSymbol = '',
}) => {
  const t = translations[language];
  const [scanMessageIndex, setScanMessageIndex] = useState(0);
  const [hudTickerIndex, setHudTickerIndex] = useState(0);
  const [multiIndexData, setMultiIndexData] = useState<MultiIndexAlphaItem[]>([]);
  const [showIndexIntelligence, setShowIndexIntelligence] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let inFlight = false;
    let activeController: AbortController | null = null;
    const fetchMultiIndex = async () => {
      if (inFlight) return;
      inFlight = true;
      const ctrl = new AbortController();
      activeController = ctrl;
      const timer = setTimeout(() => ctrl.abort(), 5000);
      try {
        const res = await fetch('/api/bot/multi-index-alpha', { signal: ctrl.signal });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setMultiIndexData(data);
          }
        }
      } catch {
        /* ignored */
      } finally {
        clearTimeout(timer);
        if (activeController === ctrl) activeController = null;
        inFlight = false;
      }
    };
    fetchMultiIndex();
    const interval = setInterval(fetchMultiIndex, 4000);
    return () => {
      isMounted = false;
      activeController?.abort();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHudTickerIndex((prev) => (prev + 1) % 6);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  const hudTickerStepsMl = [
    {
      title: 'ആന്റി-ചേൺ & ബ്രോക്കറേജ് ഷീൽഡ്',
      badge: '30-Min Lockout & Max 1 Trade/Strike',
      text: 'ഒരേ കോൺട്രാക്ട് വീണ്ടും വീണ്ടും എടുത്ത് ബ്രോക്കറേജ് നഷ്ടപ്പെടുന്നത് തടയുന്നു: ഒരു ട്രേഡിന് ശേഷം 30 മിനിറ്റ് കണിശമായ ലോക്കൗട്ടും പ്രതിദിനം പരമാവധി 1 ട്രേഡും മാത്രം...',
    },
    {
      title: 'മാക്സിമം പ്രോഫിറ്റ് റൈഡ് (Anti-Micro Scalp)',
      badge: 'പോയിന്റ് 3 & 4 പീക്ക് ഹാർവെസ്റ്റ്',
      text: 'ചെറിയ ₹25, ₹50, ₹100 പീനട്ട് ലാഭങ്ങൾക്കല്ല അൽഗോരിതം: +12% ലാഭത്തിൽ റിസ്ക്-ഫ്രീ ബ്രേക്-ഈവൻ ലോക്ക് ചെയ്ത് +25% മുതൽ +60%+ വരെയുള്ള വൻ മുന്നേറ്റം പിടിച്ചെടുക്കുന്നു...',
    },
    {
      title: 'മാർക്കറ്റ് റെജീം & ഓട്ടോ ആക്ഷൻ',
      badge: 'ഓട്ടോ ഹൈബ്രിഡ് (Buying + Selling)',
      text: 'ഇന്ത്യ VIX (13.8) നിരീക്ഷിക്കുന്നു: ശക്തമായ ട്രെൻഡിൽ Option Buying (CE/PE), സൈഡ്‌വേയ്‌സ് റേഞ്ചിൽ തീറ്റ സെല്ലിംഗ് സ്വയം തിരഞ്ഞെടുക്കുന്നു...',
    },
    {
      title: 'മൾട്ടി-സൂചിക സ്കാനർ',
      badge: 'ഓൾ ഇൻഡക്സ് ആൽഫ (Full Auto)',
      text: 'NIFTY, BANKNIFTY, SENSEX, FINNIFTY, MIDCPNIFTY ഒരേസമയം ലൈവ് സ്കാൻ ചെയ്യുന്നു: ഏറ്റവും ഉയർന്ന ലാഭസാധ്യതയുള്ള സൂചിക ബോട്ട് സ്വയം എടുക്കുന്നു...',
    },
    {
      title: 'ഡയറക്ഷൻ സ്ഥിരീകരണം',
      badge: 'ഓട്ടോ CE / PE (100% അൽഗോരിതം)',
      text: 'HDFC, Reliance, ICICI ഇൻസ്റ്റിറ്റ്യൂഷണൽ വോളിയവും SuperTrend 9/21 ക്രോസ്സും പരിശോധിച്ച് ബുള്ളിഷ് CE / ബെയറിഷ് PE സ്വയം നിർണ്ണയിക്കുന്നു...',
    },
    {
      title: 'ഡൈനാമിക് ഫണ്ട് അലോക്കേഷൻ',
      badge: 'അക്കൗണ്ട് മാർജിൻ സേഫ്റ്റി',
      text: 'നിങ്ങളുടെ അക്കൗണ്ടിലുള്ള ക്യാഷ് അടിസ്ഥാനമാക്കി ഒരേസമയം പരമാവധി എത്ര ട്രേഡുകൾ (1 മുതൽ 5 വരെ) സുരക്ഷിതമായി എടുക്കാമെന്ന് അൽഗോരിതം തീരുമാനിക്കുന്നു...',
    },
  ];

  const hudTickerStepsEn = [
    {
      title: 'Anti-Churn & Brokerage Shield',
      badge: '30-MIN LOCKOUT & 1 TRADE/DAY',
      text: 'Strictly eliminates repeated duplicate entries on the same contract: 30-minute instrument lockout and max 1 trade per strike/day to protect capital from brokerage...',
    },
    {
      title: 'Maximum Profit Trend Ride (Anti-Micro Scalp)',
      badge: 'POINTS 3 & 4 TOP HARVEST',
      text: 'An intelligent algorithm never scalps for ₹25 or ₹50 peanuts: Locks risk-free Breakeven at +12%, then rides +25% to +60%+ maximum peak expansions...',
    },
    {
      title: 'Market Regime & Action',
      badge: 'AUTO HYBRID (Buy + Sell)',
      text: 'Monitoring India VIX (13.8): Autonomous switching between Option Buying (CE/PE) in trends & Theta Selling in consolidations...',
    },
    {
      title: 'Multi-Index Alpha',
      badge: 'ALL INDICES (Full Auto)',
      text: 'Scanning NIFTY, BANKNIFTY, SENSEX, FINNIFTY, MIDCPNIFTY simultaneously: Algo automatically executes the highest profit index...',
    },
    {
      title: 'Directional Bias',
      badge: 'AUTO CE / PE (100% Algo)',
      text: 'HDFC, Reliance, ICICI institutional order flow + SuperTrend & 9/21 EMA confirm bullish CE vs bearish PE automatically...',
    },
    {
      title: 'Dynamic Fund Sizing',
      badge: 'SAFE MARGIN SCALING',
      text: 'Scales concurrent trades (1 to 5) strictly based on available real account cash without artificial manual limits...',
    },
  ];

  useEffect(() => {
    if (!botConfig.enabled) return;
    const interval = setInterval(() => {
      setScanMessageIndex((prev) => (prev + 1) % 8);
    }, 2800);
    return () => clearInterval(interval);
  }, [botConfig.enabled]);

  const scanMessagesEn = [
    'Scanning live market quotes & tick flow...',
    'Analyzing RSI (14) & MACD momentum convergence...',
    'Validating SuperTrend & 9/21 EMA institutional direction...',
    'Inspecting Fair Value Gaps (FVG) & Bank Liquidity Sweeps...',
    'Evaluating Option Greeks (Delta, Gamma, Theta Decay Shield)...',
    'Checking ATM/ITM Option Strike PCR & Open Interest (OI)...',
    'Calculating Dynamic Lot Size & 1% Capital Risk Guard...',
    'Monitoring Peak Profit Harvester for instant top exit...',
  ];

  const scanMessagesMl = [
    'ലൈവ് മാർക്കറ്റ് ഡാറ്റയും ടിക്ക് ഫ്ലോയും സ്കാൻ ചെയ്യുന്നു...',
    'RSI (14), MACD മൊമെന്റം പരിശോധിക്കുന്നു...',
    'SuperTrend, 9/21 EMA ട്രെൻഡ് കൺഫർമേഷൻ നോക്കുന്നു...',
    'ബാങ്ക് ലിക്വിഡിറ്റി സ്വീപ്പും Fair Value Gap (FVG) യും ചെക്ക് ചെയ്യുന്നു...',
    'ഓപ്ഷൻ ഗ്രീക്സ് & തീറ്റ ഡികെ ഷീൽഡ് അനലൈസ് ചെയ്യുന്നു...',
    'ATM/ITM ഓപ്ഷൻ സ്ട്രൈക്കുകളിലെ PCR, OI എന്നിവ പരിശോധിക്കുന്നു...',
    'ഡൈനാമിക് ലോട്ട് സൈസും 1% ക്യാപിറ്റൽ റിസ്കും കണക്കാക്കുന്നു...',
    'മാക്സിമം ലാഭം ലോക്ക് ചെയ്യാൻ പീക്ക് ഹാർവെസ്റ്റർ തയ്യാറാണ്...',
  ];

  const [activeTab, setActiveTab] = useState<
    'SIGNALS' | 'AI_SUPERVISOR' | 'INSTITUTIONAL' | 'SETTINGS' | 'BACKTEST' | 'TELEGRAM' | 'LOGS'
  >('SIGNALS');
  const [testAlertSending, setTestAlertSending] = useState(false);
  const [testAlertResult, setTestAlertResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [supervisorAudit, setSupervisorAudit] = useState<any>(null);
  const [deepAiScanning, setDeepAiScanning] = useState(false);
  const [supervisorQuestion, setSupervisorQuestion] = useState('');

  const supervisorInFlightRef = useRef(false);

  const fetchSupervisorAudit = async (signal?: AbortSignal) => {
    if (supervisorInFlightRef.current) return;
    supervisorInFlightRef.current = true;
    try {
      const res = await fetch('/api/bot/supervisor-audit', { signal });
      if (res.ok) {
        const data = await res.json();
        setSupervisorAudit(data);
      }
    } catch {
      // ignore transient error
    } finally {
      supervisorInFlightRef.current = false;
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    fetchSupervisorAudit(ctrl.signal);
    const timer = setInterval(() => {
      fetchSupervisorAudit(ctrl.signal);
    }, activeTab === 'AI_SUPERVISOR' ? 3000 : 5000);
    return () => {
      ctrl.abort();
      clearInterval(timer);
    };
  }, [activeTab]);

  const hasAutoTriggeredDeepScanRef = useRef(false);

  useEffect(() => {
    if (activeTab !== 'AI_SUPERVISOR') {
      hasAutoTriggeredDeepScanRef.current = false;
      return;
    }
    if (
      supervisorAudit &&
      !supervisorAudit.lastAiSupervisorDeepReport &&
      !deepAiScanning &&
      !hasAutoTriggeredDeepScanRef.current
    ) {
      hasAutoTriggeredDeepScanRef.current = true;
      handleRunDeepAiSupervisorScan();
    }
  }, [activeTab, supervisorAudit, deepAiScanning]);

  const handleRunDeepAiSupervisorScan = async () => {
    setDeepAiScanning(true);
    try {
      const res = await fetch('/api/bot/supervisor-ai-deep-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: supervisorQuestion }),
      });
      const data = await res.json();
      if (data.audit) setSupervisorAudit(data.audit);
    } catch {
      // ignore
    } finally {
      setDeepAiScanning(false);
    }
  };

  const handleSendTestTelegramAlert = async () => {
    setTestAlertSending(true);
    setTestAlertResult(null);
    try {
      const res = await fetch('/api/telegram/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botConfig.telegramBotToken,
          chatId: botConfig.telegramChatId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestAlertResult({
          success: true,
          message:
            language === 'ml'
              ? 'ടെലിഗ്രാം ടെസ്റ്റ് മെസ്സേജ് വിജയകരമായി അയച്ചു!'
              : 'Test message sent to Telegram successfully!',
        });
      } else {
        setTestAlertResult({
          success: false,
          message:
            data.error ||
            (language === 'ml'
              ? 'മെസ്സേജ് അയക്കാൻ കഴിഞ്ഞില്ല. ടോക്കണും ചാറ്റ് ഐഡിയും പരിശോധിക്കുക.'
              : 'Failed to send alert. Check Bot Token & Chat ID.'),
        });
      }
    } catch (e: any) {
      setTestAlertResult({
        success: false,
        message: e.message || 'Error communicating with server.',
      });
    } finally {
      setTestAlertSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AlgoBotHeader
        t={t}
        botConfig={botConfig}
        onUpdateBotConfig={onUpdateBotConfig}
        language={language}
      />

      <AlgoBotTabs
        t={t}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        supervisorAudit={supervisorAudit}
        botConfig={botConfig}
        signals={signals}
        language={language}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto smooth-scroll overscroll-contain p-2.5 sm:p-4 pb-36 sm:pb-8">
        {activeTab === 'SIGNALS' && (
          <SignalsTab
            t={t}
            botConfig={botConfig}
            onUpdateBotConfig={onUpdateBotConfig}
            signals={signals}
            language={language}
            scanMessageIndex={scanMessageIndex}
            multiIndexData={multiIndexData}
            showIndexIntelligence={showIndexIntelligence}
            setShowIndexIntelligence={setShowIndexIntelligence}
            scanMessagesEn={scanMessagesEn}
            scanMessagesMl={scanMessagesMl}
            onExecuteSignal={onExecuteSignal}
            quotes={quotes}
            onSelectOptionTrade={onSelectOptionTrade}
            onSelectSymbol={onSelectSymbol}
            selectedSymbol={selectedSymbol}
          />
        )}

        {activeTab === 'AI_SUPERVISOR' && (
          <AiSupervisorTab
            supervisorAudit={supervisorAudit}
            botConfig={botConfig}
            language={language}
            deepAiScanning={deepAiScanning}
            supervisorQuestion={supervisorQuestion}
            handleRunDeepAiSupervisorScan={handleRunDeepAiSupervisorScan}
            setSupervisorQuestion={setSupervisorQuestion}
          />
        )}

        {activeTab === 'INSTITUTIONAL' && (
          <InstitutionalTab
            signals={signals}
            language={language}
            quotes={quotes}
            optionChainData={optionChainData}
            activeSignal={activeSignal}
          />
        )}

        {activeTab === 'SETTINGS' && (
          <SettingsTab
            botConfig={botConfig}
            onUpdateBotConfig={onUpdateBotConfig}
            language={language}
            quotes={quotes}
            hudTickerIndex={hudTickerIndex}
            hudTickerStepsMl={hudTickerStepsMl}
            hudTickerStepsEn={hudTickerStepsEn}
          />
        )}

        {activeTab === 'BACKTEST' && (
          <BacktestTab language={language} tradeHistory={tradeHistory} />
        )}

        {activeTab === 'TELEGRAM' && (
          <TelegramTab
            botConfig={botConfig}
            onUpdateBotConfig={onUpdateBotConfig}
            language={language}
            handleSendTestTelegramAlert={handleSendTestTelegramAlert}
            testAlertSending={testAlertSending}
            testAlertResult={testAlertResult}
          />
        )}

        {activeTab === 'LOGS' && <LogsTab language={language} botLogs={botLogs} />}
      </div>
    </div>
  );
};
