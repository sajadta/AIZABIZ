const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldPush1 = `paperPositions.push({ id: 'POS'+Date.now(), symbol: optionSymbol, quantity: 50, buyPrice: optionPrice, currentLTP: optionPrice, pnl: 0, type: 'BUY' });`;
const newPush1 = `paperPositions.push({ id: 'POS'+Date.now(), symbol: optionSymbol, quantity: 50, buyPrice: optionPrice, currentLTP: optionPrice, pnl: 0, type: 'BUY', isOption: true });`;
code = code.replace(oldPush1, newPush1);

const oldPush2 = `      paperPositions.push({
        id: 'POS' + Date.now(),
        symbol,
        quantity: initialType === 'BUY' ? newOrder.quantity: -newOrder.quantity,
        buyPrice: newOrder.price,
        currentLTP: newOrder.price,
        pnl: 0,
        type: initialType
      });`;
const newPush2 = `      paperPositions.push({
        id: 'POS' + Date.now(),
        symbol,
        quantity: initialType === 'BUY' ? newOrder.quantity: -newOrder.quantity,
        buyPrice: newOrder.price,
        currentLTP: newOrder.price,
        pnl: 0,
        type: initialType,
        isOption: symbol.includes(' CE') || symbol.includes(' PE')
      });`;
code = code.replace(oldPush2, newPush2);

fs.writeFileSync('server.ts', code);
console.log('Patched isOption in server.ts');
