const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldGreeks = `                 callDelta: call.option_greeks?.delta || 0,
                 putDelta: put.option_greeks?.delta || 0,
                 callIV: call.option_greeks?.iv || 0,
                 putIV: put.option_greeks?.iv || 0,`;

const newGreeks = `                 callDelta: call.option_greeks?.delta || 0,
                 putDelta: put.option_greeks?.delta || 0,
                 callTheta: call.option_greeks?.theta || 0,
                 putTheta: put.option_greeks?.theta || 0,
                 callGamma: call.option_greeks?.gamma || 0,
                 putGamma: put.option_greeks?.gamma || 0,
                 callIV: call.option_greeks?.iv || 0,
                 putIV: put.option_greeks?.iv || 0,`;

code = code.replace(oldGreeks, newGreeks);
fs.writeFileSync('server.ts', code);
console.log('Patched server.ts greeks');
