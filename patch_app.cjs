const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add selectedInstrumentKey state
code = code.replace(
  "const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');",
  "const [selectedSymbol, setSelectedSymbol] = useState<string>('NIFTY 50');\n  const [selectedInstrumentKey, setSelectedInstrumentKey] = useState<string>('NSE_INDEX|Nifty 50');"
);

// Update fetchCandles
code = code.replace(
  "const fetchCandles = useCallback(async (symbol: string, tf: string) => {",
  "const fetchCandles = useCallback(async (symbol: string, instKey: string, tf: string) => {"
);
code = code.replace(
  "fetch(`/api/upstox/candles?symbol=${encodeURIComponent(symbol)}&interval=${tf}`);",
  "fetch(`/api/upstox/candles?symbol=${encodeURIComponent(symbol)}&instrumentKey=${encodeURIComponent(instKey)}&interval=${tf}`);"
);

// Update calls to fetchCandles
code = code.replace(
  "fetchCandles(selectedSymbol, interval);",
  "fetchCandles(selectedSymbol, selectedInstrumentKey, interval);"
);
code = code.replace(
  "fetchCandles(selectedSymbol, interval); ",
  "fetchCandles(selectedSymbol, selectedInstrumentKey, interval); "
);

// Make sure it depends on selectedInstrumentKey
code = code.replace(
  "[selectedSymbol, interval, fetchCandles, fetchOptionChain]);",
  "[selectedSymbol, selectedInstrumentKey, interval, fetchCandles, fetchOptionChain]);"
);

// In Watchlist prop
code = code.replace(
  "onSelectSymbol={setSelectedSymbol}",
  "onSelectSymbol={(sym, key) => {\n                   setSelectedSymbol(sym);\n                   if(key) setSelectedInstrumentKey(key);\n                 }}"
);

// Add onViewChart to OptionChainView
code = code.replace(
  "onSelectOptionTrade={openOrderModal}",
  "onSelectOptionTrade={openOrderModal}\n              onViewChart={(sym, key) => {\n                setSelectedSymbol(sym);\n                setSelectedInstrumentKey(key);\n                setAppTab('MARKETS');\n              }}"
);

fs.writeFileSync('src/App.tsx', code);
console.log('Patched App.tsx');
