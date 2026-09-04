const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Remove OrderBookPositions from MARKETS
app = app.replace(
  /<div className="h-\[40vh\] md:h-\[60vh\] p-2 relative shrink-0">/,
  '<div className="flex-1 p-2 relative">'
);

// We need to carefully remove the OrderBookPositions container from MARKETS.
app = app.replace(
  /<div className="flex-1 overflow-y-auto hide-scrollbar p-2 bg-slate-900\/80 border-t border-slate-800">[\s\S]*?<OrderBookPositions[\s\S]*?\/>[\s\S]*?<\/div>/,
  ''
);

// 2. Replace PORTFOLIO tab content with OrderBookPositions full screen view
const portfolioRegex = /\{appTab === 'PORTFOLIO' && \([\s\S]*?\/\* Positions \*\/[\s\S]*?<\/div>\s*<\/div>\s*\)\}/;

app = app.replace(portfolioRegex, 
`{appTab === 'PORTFOLIO' && (
          <div className="flex-1 flex flex-col h-full bg-slate-900/80 p-2">
            <div className="flex-1 bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
               <OrderBookPositions 
                  positions={enrichedPositions}
                  orders={orders}
                  tradeHistory={tradeHistory}
                  language={language}
                  totalPnL={enrichedPositions.reduce((acc, p) => acc + (p.pnl || 0), 0)}
                  onSquareOffPosition={handleSquareOffPosition}
                  onSquareOffAll={handleSquareOffAll}
               />
            </div>
          </div>
        )}`
);

// Update nav text
app = app.replace(/<span className="text-\[10px\] font-bold">Portfolio<\/span>/g, '<span className="text-[10px] font-bold">Orders & P&L</span>');

fs.writeFileSync('src/App.tsx', app);
console.log("Patched App.tsx");
