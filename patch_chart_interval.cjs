const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Remove chartInterval from first useEffect
code = code.replace(
  "    const chartInterval = window.setInterval(() => { fetchCandles(selectedSymbol, interval); }, 10000);\n\n    return () => {\n      window.clearInterval(quoteInterval);\n      window.clearInterval(tradingInterval);\n      window.clearInterval(botInterval);\n      window.clearInterval(chartInterval);\n    };",
  "    return () => {\n      window.clearInterval(quoteInterval);\n      window.clearInterval(tradingInterval);\n      window.clearInterval(botInterval);\n    };"
);

// Add chartInterval to second useEffect
const newSecondUseEffect = `
  // When selected symbol or timeframe changes, refresh chart & option chain
  useEffect(() => {
    fetchCandles(selectedSymbol, interval);
    if (selectedSymbol.includes('NIFTY') || selectedSymbol.includes('BANK') || selectedSymbol.includes('SENSEX')) {
      fetchOptionChain(selectedSymbol);
    }

    const chartInterval = window.setInterval(() => { 
      fetchCandles(selectedSymbol, interval); 
      if (selectedSymbol.includes('NIFTY') || selectedSymbol.includes('BANK') || selectedSymbol.includes('SENSEX')) {
         fetchOptionChain(selectedSymbol);
      }
    }, 10000);

    return () => window.clearInterval(chartInterval);
  }, [selectedSymbol, interval, fetchCandles, fetchOptionChain]);
`;

code = code.replace(
  /  \/\/ When selected symbol or timeframe changes, refresh chart & option chain\s*useEffect\(\(\) => \{\s*fetchCandles\(selectedSymbol, interval\);\s*if \(selectedSymbol\.includes\('NIFTY'\) \|\| selectedSymbol\.includes\('BANK'\)\) \{\s*fetchOptionChain\(selectedSymbol\);\s*\}\s*\}, \[selectedSymbol, interval, fetchCandles, fetchOptionChain\]\);/,
  newSecondUseEffect.trim()
);

fs.writeFileSync('src/App.tsx', code);
