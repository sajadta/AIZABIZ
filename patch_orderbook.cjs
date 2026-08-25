const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldComponent = `<OrderBookPositions 
                    positions={positions}
                    orders={orders}
                    language={language}
                 />`;

const newComponent = `const currentTotalPnL = positions.reduce((acc, p) => acc + (p.pnl || 0), 0);
                 return (
                 <OrderBookPositions 
                    positions={positions}
                    orders={orders}
                    language={language}
                    totalPnL={currentTotalPnL}
                    onSquareOffPosition={handleSquareOffPosition}
                    onSquareOffAll={handleSquareOffAll}
                 />
                 );`;

code = code.replace(oldComponent, `<OrderBookPositions 
                    positions={positions}
                    orders={orders}
                    language={language}
                    totalPnL={positions.reduce((acc, p) => acc + (p.pnl || 0), 0)}
                    onSquareOffPosition={handleSquareOffPosition}
                    onSquareOffAll={handleSquareOffAll}
                 />`);

fs.writeFileSync('src/App.tsx', code);
console.log('Patched App.tsx');
