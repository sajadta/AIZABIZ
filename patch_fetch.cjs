const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = "  const fetchQuotes = useCallback(async () => {\n    try {\n      const res = await fetch(`/api/upstox/quotes${selectedInstrumentKey ? `?symbols=${encodeURIComponent(selectedInstrumentKey)}` : ''}`);";

const replaceStr = "  const fetchQuotes = useCallback(async () => {\n    try {\n      const res = await fetch(`/api/upstox/quotes`);";

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log("Patched fetchQuotes in App.tsx");
