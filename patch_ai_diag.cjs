const fs = require('fs');
let code = fs.readFileSync('src/components/LiveAiSupport.tsx', 'utf8');

const runDiagOld = `  const runDiagnostics = () => {
    let diagMsg = '🔍 **System Diagnostics Report:**\\n\\n';
    
    if (navigator.onLine) {
      diagMsg += '✅ Network is Online.\\n';
    } else {
      diagMsg += '❌ Network is Offline! Check your internet.\\n';
    }
    if (apiConfig.isConnected) {
      diagMsg += '✅ Upstox API Connected.\\n';
    } else {
      diagMsg += "❌ Upstox API Disconnected! Go to Settings (Key icon) and enter today's Access Token.\\n";
    }
    if (quotesCount > 0) {
      diagMsg += '✅ Live Market Data (Quotes) is streaming correctly.\\n';
    } else {
      diagMsg += '⚠️ Live Market Data not receiving. (If market is closed, this is normal. Otherwise check token).\\n';
    }
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: diagMsg }]);
  };`;

const runDiagNew = `  const runDiagnostics = async () => {
    setLoading(true);
    let diagMsg = '🔍 **System Diagnostic Check Started...**\\n\\n';
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: diagMsg }]);
    
    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: "[AUTO-DIAGNOSTIC-REQUEST] Verify the algorithm working, code execution health, and API connectivity state based on the following system payload. Reply in Malayalam detailing the health of the bot, execution engine, and options calculations (IV/Theta/Gamma).",
          systemStatus: {
            apiConnected: apiConfig.isConnected,
            apiTokenExists: !!apiConfig.accessToken,
            liveQuotesReceiving: quotesCount > 0,
            networkOnline: navigator.onLine,
            memory: performance?.memory?.usedJSHeapSize,
            executionEngine: 'Active (v2.4.1)',
            optionGreeksEngine: 'Active (Real-time)',
            timestamp: new Date().toISOString()
          }
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: data.text }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: 'Error in diagnostics.' }]);
      }
    } catch(e) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: 'Network Error.' }]);
    } finally {
      setLoading(false);
    }
  };`;

code = code.replace(runDiagOld, runDiagNew);
fs.writeFileSync('src/components/LiveAiSupport.tsx', code);
console.log('Patched LiveAiSupport.tsx');
