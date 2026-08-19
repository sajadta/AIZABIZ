const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `
  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch('/api/upstox/quotes');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.quotes || []);
        setQuotes(list);
        
        // Sync LTP to Paper Trading backend so PNL calculates accurately
        if (list.length > 0) {
           fetch('/api/trading/paper-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quotes: list })
           }).catch(() => {});
        }
      }
    } catch {
      // Soft handling during server reconnect / transient network delay
    }
  }, []);
`;

code = code.replace(
  /const fetchQuotes = useCallback\(async \(\) => \{\s*try \{\s*const res = await fetch\('\/api\/upstox\/quotes'\);\s*if \(res.ok\) \{\s*const data = await res.json\(\);\s*const list = Array.isArray\(data\) \? data : \(data.quotes \|\| \[\]\);\s*setQuotes\(list\);\s*\}\s*\} catch \{\s*\/\/ Soft handling during server reconnect \/ transient network delay\s*\}\s*\}, \[\]\);/,
  replacement
);

// We need to make sure fetchPositions passes the mode
code = code.replace(
  "fetch('/api/trading/positions'),",
  "fetch(`/api/trading/positions?mode=${mode}`),"
);
code = code.replace(
  "fetch('/api/trading/orders'),",
  "fetch(`/api/trading/orders?mode=${mode}`),"
);

fs.writeFileSync('src/App.tsx', code);
