const fs = require('fs');

let orderModal = fs.readFileSync('src/components/OrderModal.tsx', 'utf8');
orderModal = orderModal.replace(`if (sym.includes('NIFTY')) return 25;`, `if (sym.includes('NIFTY')) return 65;`);
fs.writeFileSync('src/components/OrderModal.tsx', orderModal);

let server = fs.readFileSync('server.ts', 'utf8');
server = server.replace(`optionSymbol.includes('NIFTY') ? 25`, `optionSymbol.includes('NIFTY') ? 65`);
fs.writeFileSync('server.ts', server);

console.log('Patched Nifty lot size to 65');
