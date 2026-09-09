const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(
  /if \(liveQuotesMap\[mainKey\]\?\.last_price\) \{\s*currentLiveQuote = liveQuotesMap\[mainKey\]\.last_price;\s*\}/,
  `let mq = liveQuotesMap[mainKey] || Object.values(liveQuotesMap).find((q:any) => q.instrument_token === mainKey);
          if (mq?.last_price) {
            currentLiveQuote = mq.last_price;
          }`
);
fs.writeFileSync('server.ts', code);
