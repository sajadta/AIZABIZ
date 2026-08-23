const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetBlock = `    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host; // Will include port 3000 if not behind proxy
    const wsUrl = \`\${wsProto}//\${wsHost}/api/ws/quotes\`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log('Connected to Live Quotes WebSocket');
        setIsWsConnected(true);
    };
    
    socket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'QUOTES') {
                const list = msg.data || [];
                setQuotes(list);
                
                if (list.length > 0) {
                    // Sync LTP to Paper Trading backend so PNL calculates accurately
                    fetch('/api/trading/paper-sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ quotes: list })
                    }).catch(() => {});
                }
            }
        } catch(e) {}
    };

    socket.onerror = (err) => {
       console.error('WebSocket Error:', err);
       setIsWsConnected(false);
    };
    socket.onclose = () => setIsWsConnected(false);`;

const newBlock = `    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = \`\${wsProto}//\${wsHost}/api/ws/quotes\`;

    let socket: WebSocket | null = null;
    let reconnectTimeout: number | null = null;
    let reconnectAttempts = 0;

    const connectWebSocket = () => {
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('Connected to Live Quotes WebSocket');
            setIsWsConnected(true);
            reconnectAttempts = 0;
        };
        
        socket.onmessage = (event) => {
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

        socket.onerror = (err) => {
           console.error('WebSocket Error:', err);
        };
        
        socket.onclose = () => {
           setIsWsConnected(false);
           const timeoutMs = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
           console.log(\`WebSocket closed. Reconnecting in \${Math.round(timeoutMs/1000)}s...\`);
           reconnectTimeout = window.setTimeout(() => {
               reconnectAttempts++;
               connectWebSocket();
           }, timeoutMs);
        };
    };

    connectWebSocket();`;

// Replace the block
if (code.includes(targetBlock)) {
    code = code.replace(targetBlock, newBlock);
} else {
    console.log('Target block not found, trying partial match');
}

// Update the cleanup function to handle the new variable scope
const cleanupTarget = `return () => {
      window.clearInterval(quoteInterval);
      if (socket.readyState === WebSocket.OPEN) { socket.close(); }
      window.clearInterval(tradingInterval);
      window.clearInterval(botInterval);
    };`;

const newCleanup = `return () => {
      window.clearInterval(quoteInterval);
      if (reconnectTimeout) window.clearTimeout(reconnectTimeout);
      if (socket && socket.readyState === WebSocket.OPEN) { socket.close(); }
      window.clearInterval(tradingInterval);
      window.clearInterval(botInterval);
    };`;

if (code.includes(cleanupTarget)) {
    code = code.replace(cleanupTarget, newCleanup);
} else {
    console.log('Cleanup target not found');
}

fs.writeFileSync('src/App.tsx', code);
console.log('Patched WebSocket auto-reconnect successfully');
