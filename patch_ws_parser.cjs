const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

const target = "const ff = (feed as any).ff || (feed as any).optionGreeks || (feed as any).ltpc;";
const replacement = "const ff = (feed as any).fullFeed || (feed as any).ff || (feed as any).optionGreeks || (feed as any).ltpc || feed;";

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('server.ts', content);
    console.log("Patched WS parser.");
} else {
    console.log("Target not found!");
}
