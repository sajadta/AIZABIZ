const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  /if \(\s*liveQuotesMap\[pos\.instrumentKey\] &&\s*liveQuotesMap\[pos\.instrumentKey\]\.last_price\s*\) \{\s*pos\.currentLTP = liveQuotesMap\[pos\.instrumentKey\]\.last_price;\s*pos\.pnl = \(pos\.currentLTP - pos\.buyPrice\) \* pos\.quantity;\s*\}/,
  `let quoteObj = liveQuotesMap[pos.instrumentKey];
      if (!quoteObj) {
        quoteObj = Object.values(liveQuotesMap).find((q: any) => q.instrument_token === pos.instrumentKey);
      }
      if (quoteObj && quoteObj.last_price) {
        pos.currentLTP = quoteObj.last_price;
        pos.pnl = (pos.currentLTP - pos.buyPrice) * pos.quantity;
      }`
);
fs.writeFileSync('server.ts', code);
