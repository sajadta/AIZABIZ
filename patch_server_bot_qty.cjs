const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const botQtyLogic = `                   const botQty = optionSymbol.includes('FIN SERVICE') || optionSymbol.includes('FINNIFTY') ? 65 : optionSymbol.includes('BANK') ? 15 : optionSymbol.includes('NIFTY') ? 25 : optionSymbol.includes('SENSEX') ? 10 : 10;
                   paperOrders.unshift({ id: 'ORD'+Date.now(), symbol: optionSymbol, type: 'BUY', quantity: botQty, price: optionPrice, status: 'COMPLETE', time: new Date().toISOString() });
                   paperPositions.push({ id: 'POS'+Date.now(), symbol: optionSymbol, quantity: botQty, buyPrice: optionPrice, currentLTP: optionPrice, pnl: 0, type: 'BUY', isOption: true });`;

const oldBotLogic = `                   paperOrders.unshift({ id: 'ORD'+Date.now(), symbol: optionSymbol, type: 'BUY', quantity: 50, price: optionPrice, status: 'COMPLETE', time: new Date() .toISOString()  });
                   paperPositions.push({ id: 'POS'+Date.now(), symbol: optionSymbol, quantity: 50, buyPrice: optionPrice, currentLTP: optionPrice, pnl: 0, type: 'BUY', isOption: true });`;

code = code.replace(oldBotLogic, botQtyLogic);
fs.writeFileSync('server.ts', code);
console.log('Patched bot qty');
