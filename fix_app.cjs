const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// The eventSource onmessage handler currently expects: { type: 'QUOTES', data: list }
// BUT, my SSE server side currently sends { type: 'CONNECTED' } 
// If it tries to parse other things it might fail, let's just make it safer:
const oldOnMessage = `        eventSource.onmessage = (event) => {
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
        };`;

const newOnMessage = `        eventSource.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'CONNECTED') {
                    console.log('SSE Stream fully established.');
                }
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
        };`;

code = code.replace(oldOnMessage, newOnMessage);
fs.writeFileSync('src/App.tsx', code);
console.log('Fixed onmessage');
