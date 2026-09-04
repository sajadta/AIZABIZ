const fs = require('fs');

// Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');
const fetchCandlesRegex = /const fetchCandles = useCallback\(async \(symbol: string, instKey: string, tf: string\) => \{([\s\S]*?)\}, \[\]\);/;

const newFetchCandles = `const fetchCandles = useCallback(async (symbol: string, instKey: string, tf: string) => {
    try {
      const res = await fetch(\`/api/upstox/candles?symbol=\${encodeURIComponent(symbol)}&instrumentKey=\${encodeURIComponent(instKey)}&interval=\${tf}\`);
      if (res.ok) {
        const data = await res.json();
        if (data.success === false && data.error) {
           console.error("Upstox Candles API Error:", data.error, data.raw);
           setActiveToast({ message: \`Chart Error: \${JSON.stringify(data.error)}\`, type: 'ERROR' });
        }
        const list = Array.isArray(data) ? data : (data.candles || []);
        setCandles(enrichCandlesWithIndicators(list));
      } else {
        const errText = await res.text();
        console.error("Upstox Candles HTTP Error:", errText);
        setActiveToast({ message: \`Chart HTTP Error: \${res.status}\`, type: 'ERROR' });
      }
    } catch (err: any) {
      console.error("Upstox Candles Fetch Error:", err);
    }
  }, []);`;

if (fetchCandlesRegex.test(appCode)) {
    appCode = appCode.replace(fetchCandlesRegex, newFetchCandles);
    fs.writeFileSync('src/App.tsx', appCode);
    console.log("Patched App.tsx");
} else {
    console.log("Regex didn't match App.tsx.");
}

// Patch server.ts
let serverCode = fs.readFileSync('server.ts', 'utf-8');
const serverRegex = /return res\.json\(\{ success: true, symbol, interval, candles: \[\] \}\);\n\s*\} catch \(err: any\)  \{\n\s*return res\.json\(\{ success: true, symbol, interval, candles: \[\] \}\);/;

const newServerResponse = `return res.json({ success: false, symbol, interval, candles: [], error: data.errors || data.message || 'API returned no candles', raw: data });
  } catch (err: any)  {
    return res.status(500).json({ success: false, symbol, interval, error: err.message });`;

if (serverRegex.test(serverCode)) {
    serverCode = serverCode.replace(serverRegex, newServerResponse);
    fs.writeFileSync('server.ts', serverCode);
    console.log("Patched server.ts");
} else {
    console.log("Regex didn't match server.ts.");
}
