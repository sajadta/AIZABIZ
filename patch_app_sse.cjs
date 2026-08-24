const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const wsCodeStart = `    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';`;
const wsCodeEnd = `    connectWebSocket();`;

if (code.includes(wsCodeStart) && code.includes(wsCodeEnd)) {
    const p1 = code.slice(0, code.indexOf(wsCodeStart));
    const p2 = code.slice(code.indexOf(wsCodeEnd) + wsCodeEnd.length);
    
    const sseCode = `
    let eventSource: EventSource | null = null;
    let reconnectTimeout: number | null = null;
    let reconnectAttempts = 0;
    
    const connectEventSource = () => {
        eventSource = new EventSource('/api/stream/quotes');
        
        eventSource.onopen = () => {
            console.log('Connected to Live Quotes SSE');
            setIsWsConnected(true);
            reconnectAttempts = 0;
        };
        
        eventSource.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'QUOTES') {
                    const list = msg.data || [];
                    setQuotes(list);
                    if (list.length > 0) {
                        fetch('/api/trading/paper-sync', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ quotes: list })
                        }).catch(() => {});
                    }
                }
            } catch(e) {}
        };
        
        eventSource.onerror = (err) => {
           console.error('SSE Error:', err);
           setIsWsConnected(false);
           eventSource?.close();
           const timeoutMs = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
           console.log(\`SSE closed. Reconnecting in \${Math.round(timeoutMs/1000)}s...\`);
           reconnectTimeout = window.setTimeout(() => {
               reconnectAttempts++;
               connectEventSource();
           }, timeoutMs);
        };
    };

    connectEventSource();
    `;
    
    code = p1 + sseCode + p2;
    // Replace the cleanup code
    code = code.replace(
        'if (socket && socket.readyState === WebSocket.OPEN) { socket.close(); }',
        'if (eventSource) { eventSource.close(); }'
    );
    
    fs.writeFileSync('src/App.tsx', code);
    console.log('Successfully patched App.tsx to use SSE');
} else {
    console.log('Error patching App.tsx');
}
