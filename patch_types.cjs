const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

const oldStrike = `  callDelta: number;
  putDelta: number;
  callIV: number;
  putIV: number;`;

const newStrike = `  callDelta: number;
  putDelta: number;
  callTheta?: number;
  putTheta?: number;
  callGamma?: number;
  putGamma?: number;
  callIV: number;
  putIV: number;`;

code = code.replace(oldStrike, newStrike);
fs.writeFileSync('src/types.ts', code);
console.log('Patched types');
