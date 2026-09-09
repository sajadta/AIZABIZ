const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'const optInstrumentKey =\n                  signal.instrumentKey || "NSE_FO|" + optionSymbol;',
  'const optInstrumentKey =\n                  signal.instrumentKey || signal.underlyingInstrumentKey || "NSE_FO|" + optionSymbol;'
);

code = code.replace(
  'const optInstrumentKey =\n                    signal.instrumentKey || "NSE_FO|" + optionSymbol;',
  'const optInstrumentKey =\n                    signal.instrumentKey || signal.underlyingInstrumentKey || "NSE_FO|" + optionSymbol;'
);

// We should also fix `liveQuotesMap` logic in the botLoop to use `symbol` if `instrumentKey` fails.
fs.writeFileSync('server.ts', code);
