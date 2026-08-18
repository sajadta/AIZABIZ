const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Import analyzeConfluence
if (!code.includes('analyzeConfluence')) {
  code = code.replace(
    "import { translations } from './translations';",
    "import { translations } from './translations';\nimport { analyzeConfluence } from './utils/indicators';"
  );
}

// Modify runGeminiAnalysis to include data
const newRunGeminiAnalysis = `
  const runGeminiAnalysis = useCallback(async () => {
    setAiLoading(true);
    try {
      const quote = quotes.find(q => q.symbol === selectedSymbol);
      let indicators = null;
      if (candles.length > 0) {
        const analysis = analyzeConfluence(candles);
        indicators = analysis.readings;
      }
      
      const payload = { 
        symbol: selectedSymbol, 
        interval,
        ltp: quote?.ltp || 0,
        changePercent: quote?.changePercent || 0,
        indicators
      };

      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setGeminiAnalysis(data.data || data);
        if (soundEnabled) soundEngine.play('SUCCESS');
      }
    } catch {
      // Soft handling
    } finally {
      setAiLoading(false);
    }
  }, [selectedSymbol, interval, quotes, candles, soundEnabled]);
`;

code = code.replace(
  /const runGeminiAnalysis = useCallback\(async \(\) => \{[\s\S]*?\}, \[selectedSymbol, interval, soundEnabled\]\);/,
  newRunGeminiAnalysis.trim()
);

fs.writeFileSync('src/App.tsx', code);
