const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `        symbol={orderModalData.symbol}
        defaultPrice={orderModalData.price}
        initialType={orderModalData.initialType}`;

const replaceStr = `        symbol={orderModalData.symbol}
        defaultPrice={orderModalData.price}
        initialType={orderModalData.initialType}
        defaultStopLoss={(orderModalData as any).stopLoss}
        defaultTarget={(orderModalData as any).target}`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx OrderModal JSX");
