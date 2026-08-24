const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldSseLogic = `    const fetchAndPushQuotes = async () => {
        const token = upstoxConfig.accessToken;
        if (!token) return;
        try {`;

const newSseLogic = `    // Send an initial connected message
    res.write('data: {"type": "CONNECTED"}\\n\\n');

    const fetchAndPushQuotes = async () => {
        // Send a heartbeat comment to keep the connection alive through proxies
        res.write(':\\n\\n');

        const token = upstoxConfig.accessToken;
        if (!token) {
            // Just send a keep-alive if no token so the connection doesn't drop
            return;
        }
        try {`;

if (code.includes(oldSseLogic)) {
    code = code.replace(oldSseLogic, newSseLogic);
    fs.writeFileSync('server.ts', code);
    console.log('Patched SSE keep-alive in server.ts');
} else {
    console.log('Could not find SSE logic to patch');
}
