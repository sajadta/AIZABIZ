// Supervisor audit polling, deep AI scan trigger and Telegram test-alert plumbing.
import { useEffect, useRef, useState } from 'react';
import type { BotConfig, Language } from '../../types';
import { errorMessage } from '../../utils/errors';
import type { SupervisorAudit } from './types';

type SupervisorTab = 'AI_SUPERVISOR' | string;

interface UseSupervisorAuditParams {
  activeTab: SupervisorTab;
  botConfig: BotConfig;
  language: Language;
}

export function useSupervisorAudit({ activeTab, botConfig, language }: UseSupervisorAuditParams) {
  const [supervisorAudit, setSupervisorAudit] = useState<SupervisorAudit | null>(null);
  const [deepAiScanning, setDeepAiScanning] = useState(false);
  const [supervisorQuestion, setSupervisorQuestion] = useState('');
  const [testAlertSending, setTestAlertSending] = useState(false);
  const [testAlertResult, setTestAlertResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const supervisorInFlightRef = useRef(false);
  const hasAutoTriggeredDeepScanRef = useRef(false);

  const fetchSupervisorAudit = async (signal?: AbortSignal) => {
    if (supervisorInFlightRef.current) return;
    supervisorInFlightRef.current = true;
    try {
      const res = await fetch('/api/bot/supervisor-audit', { signal });
      if (res.ok) {
        const data = (await res.json()) as SupervisorAudit;
        setSupervisorAudit(data);
      }
    } catch {
      // ignore transient error
    } finally {
      supervisorInFlightRef.current = false;
    }
  };

  const handleRunDeepAiSupervisorScan = async () => {
    setDeepAiScanning(true);
    try {
      const res = await fetch('/api/bot/supervisor-ai-deep-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: supervisorQuestion }),
      });
      const data = (await res.json()) as { audit?: SupervisorAudit };
      if (data.audit) setSupervisorAudit(data.audit);
    } catch {
      // ignore
    } finally {
      setDeepAiScanning(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    fetchSupervisorAudit(ctrl.signal);
    const timer = setInterval(
      () => {
        fetchSupervisorAudit(ctrl.signal);
      },
      activeTab === 'AI_SUPERVISOR' ? 3000 : 5000,
    );
    return () => {
      ctrl.abort();
      clearInterval(timer);
    };
  }, [activeTab]);

  const handleRunDeepScanRef = useRef(handleRunDeepAiSupervisorScan);
  handleRunDeepScanRef.current = handleRunDeepAiSupervisorScan;

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
      handleRunDeepScanRef.current();
    }
  }, [activeTab, supervisorAudit, deepAiScanning]);

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
    } catch (e) {
      setTestAlertResult({
        success: false,
        message: errorMessage(e) || 'Error communicating with server.',
      });
    } finally {
      setTestAlertSending(false);
    }
  };

  return {
    supervisorAudit,
    deepAiScanning,
    supervisorQuestion,
    setSupervisorQuestion,
    handleRunDeepAiSupervisorScan,
    testAlertSending,
    testAlertResult,
    handleSendTestTelegramAlert,
  };
}
