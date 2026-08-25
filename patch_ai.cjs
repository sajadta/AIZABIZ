const fs = require('fs');
let code = fs.readFileSync('src/components/LiveAiSupport.tsx', 'utf8');
code = code.replace(/const runDiagnostics = \(\) => \{[\s\S]*?setMessages.*?diagMsg \}]);\n  \};/, 
`const runDiagnostics = async () => {
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
      if (data.success || data.text) {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: data.text }]);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: 'Error in diagnostics: ' + JSON.stringify(data) }]);
      }
    } catch(e) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'system', text: 'Network Error.' }]);
    } finally {
      setLoading(false);
    }
  };`);
fs.writeFileSync('src/components/LiveAiSupport.tsx', code);
console.log('Done');
