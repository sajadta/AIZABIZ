const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /\/\/ Convert 'NSE_INDEX\|Nifty 50' to symbol 'NIFTY 50'\s*const symbolParts = key\.split\('\|'\);\s*const symbolDisplay = item\.symbol \|\| \(symbolParts\.length > 1 \? symbolParts\[1\]\.toUpperCase\(\) : key\);/m;

const replacement = `// Extract correct symbol since Upstox can return 'NA' or use ':' instead of '|'
        let symbolDisplay = item.symbol;
        if (!symbolDisplay || symbolDisplay === 'NA') {
           const parts = key.split(/[:|]/);
           symbolDisplay = (parts.length > 1 ? parts[1] : key).toUpperCase();
        } else {
           symbolDisplay = symbolDisplay.toUpperCase();
        }`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', code);
  console.log("Successfully fixed quote symbol mapping!");
} else {
  console.log("Regex did not match!");
}
