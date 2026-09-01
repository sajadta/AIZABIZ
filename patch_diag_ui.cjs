const fs = require('fs');
let content = fs.readFileSync('src/components/DiagnosticsModal.tsx', 'utf-8');

if (!content.includes('health.lastWsError')) {
    content = content.replace(
        "<span>Server Time: {new Date(health.systemTime).toLocaleTimeString()}</span>", 
        "<span>Server Time: {new Date(health.systemTime).toLocaleTimeString()}</span>\n                                 {health.lastWsError && <span className=\"text-rose-400 mt-2\">WS Error: {health.lastWsError}</span>}"
    );
    fs.writeFileSync('src/components/DiagnosticsModal.tsx', content);
}
