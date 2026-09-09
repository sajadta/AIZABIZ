const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  '        pos.currentLTP = q.ltp;\n        pos.pnl = (q.ltp - pos.buyPrice) * pos.quantity;\n        pos.pnlPercent = ((q.ltp - pos.buyPrice) / pos.buyPrice) * 100;',
  '        if (pos.isOption && q.ltp > pos.buyPrice * 50) {\n          // Skip, this is the underlying index price\n        } else {\n          pos.currentLTP = q.ltp;\n          pos.pnl = (q.ltp - pos.buyPrice) * pos.quantity;\n          pos.pnlPercent = ((q.ltp - pos.buyPrice) / pos.buyPrice) * 100;\n        }'
);

fs.writeFileSync('server.ts', code);
