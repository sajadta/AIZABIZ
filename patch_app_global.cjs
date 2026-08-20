const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `               {['NIFTY 50', 'NIFTY BANK', 'NIFTY FIN SERVICE', 'NIFTY MID SELECT', 'SENSEX', 'BANKEX'].map(sym => {`;
const replacement = `               {['NIFTY 50', 'NIFTY BANK', 'SENSEX', 'NASDAQ', 'DOW JONES', 'GIFT NIFTY'].map(sym => {`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
