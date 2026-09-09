const fs = require('fs');
let code = fs.readFileSync('src/utils/indicators.ts', 'utf8');
code = code.replace(
  '    instrumentKey,\n    signalType,',
  '    instrumentKey,\n    underlyingInstrumentKey: instrumentKey,\n    signalType,'
);
fs.writeFileSync('src/utils/indicators.ts', code);
