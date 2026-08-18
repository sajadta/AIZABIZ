const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Fix NaN in Positions
code = code.replace(/Number\(p\.buyPrice\)\.toFixed\(2\)/g, "Number(p.buyPrice || 0).toFixed(2)");
code = code.replace(/Number\(p\.currentLTP\)\.toFixed\(2\)/g, "Number(p.currentLTP || 0).toFixed(2)");
code = code.replace(/Number\(p\.pnl\)\.toFixed\(2\)/g, "Number(p.pnl || 0).toFixed(2)");

// Fix NaN in Holdings
code = code.replace(/Number\(h\.buyPrice\)\.toFixed\(2\)/g, "Number(h.buyPrice || 0).toFixed(2)");
code = code.replace(/Number\(h\.currentLTP\)\.toFixed\(2\)/g, "Number(h.currentLTP || 0).toFixed(2)");
code = code.replace(/Number\(h\.pnl\)\.toFixed\(2\)/g, "Number(h.pnl || 0).toFixed(2)");

// Fix fixed heights causing scroll gaps
code = code.replace(/h-\[340px\]/g, "h-[45vh] min-h-[340px]");
code = code.replace(/h-\[400px\]/g, "flex-1 min-h-[400px]");
code = code.replace(/h-\[600px\]/g, "flex-1 h-full min-h-[600px]");
code = code.replace(/pb-20/g, "pb-24");

fs.writeFileSync('src/App.tsx', code);
