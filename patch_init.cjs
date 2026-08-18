const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const initCode = `
  // Initial Local Storage Setup Check
  useEffect(() => {
    const isSetupComplete = localStorage.getItem('app_setup_complete');
    if (!isSetupComplete) {
      setIsOnboardingOpen(true);
    } else {
      // Sync local config to backend if backend was restarted
      const tgToken = localStorage.getItem('algo_tg_token');
      const tgChat = localStorage.getItem('algo_tg_chat');
      if (tgToken && tgChat) {
        fetch('/api/bot/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramBotToken: tgToken, telegramChatId: tgChat, telegramAlertsEnabled: true })
        }).catch(() => {});
      }
    }
  }, []);
`;

code = code.replace('  // Initial Load & Intervals', initCode + '\n  // Initial Load & Intervals');

code = code.replace('</AnimatePresence>', `</AnimatePresence>
      <OnboardingSetupModal 
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onSave={(data) => {
          handleUpdateBotConfig(data.botConfig);
          // could also handle api config save
        }}
        defaultBotConfig={botConfig}
        defaultApiConfig={apiConfig}
        language={language}
      />`);

fs.writeFileSync('src/App.tsx', code);
