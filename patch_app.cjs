const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const hookToInsert = `
  // Subscribe to position instrument keys
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && positions.length > 0) {
        const keys = positions.map(p => p.instrumentKey).filter(Boolean);
        if (keys.length > 0) {
             wsRef.current.send(JSON.stringify({ type: 'SUBSCRIBE', keys }));
        }
    }
  }, [positions]);
`;

if (!content.includes('Subscribe to position instrument keys')) {
    content = content.replace('// When selected symbol or timeframe changes, refresh chart & option chain', hookToInsert + '\n// When selected symbol or timeframe changes, refresh chart & option chain');
    fs.writeFileSync('src/App.tsx', content);
}
