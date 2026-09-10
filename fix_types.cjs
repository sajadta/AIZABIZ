const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');
code = code.replace(
  '  instrumentKey: string;\n  signalType: SignalType;',
  '  instrumentKey: string;\n  underlyingInstrumentKey?: string;\n  signalType: SignalType;'
);
fs.writeFileSync('src/types.ts', code);
