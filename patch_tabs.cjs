const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf-8');

app = app.replace(
  /const \[appTab, setAppTab\] = useState\<'MARKETS' \| 'BOT' \| 'OPTIONS' \| 'PORTFOLIO' \| 'SUPPORT'\>\('MARKETS'\);/,
  "const [appTab, setAppTab] = useState<'MARKETS' | 'BOT' | 'OPTIONS' | 'PORTFOLIO' | 'ORDERS' | 'SUPPORT'>('MARKETS');"
);

// We need to change the existing appTab === 'PORTFOLIO' block to appTab === 'ORDERS'
const ordersTabRegex = /\{appTab === 'PORTFOLIO' && \([\s\S]*?<OrderBookPositions[\s\S]*?<\/div>\s*<\/div>\s*\)\}/;
app = app.replace(ordersTabRegex, 
`{appTab === 'ORDERS' && (
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
        )}
        
        {appTab === 'PORTFOLIO' && (
          <div className="space-y-4 flex flex-col flex-1 h-full min-h-[600px] p-2">
            {/* Margin Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Account Balance</p>
                <p className="text-lg font-black text-white">₹{((apiConfig?.availableMargin || 0) + (apiConfig?.usedMargin > 0 ? apiConfig.usedMargin : 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Available Margin</p>
                <p className="text-lg font-black text-emerald-400">₹{apiConfig?.availableMargin?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0.00'}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Used Margin (Active)</p>
                <p className="text-lg font-black text-rose-400">₹{apiConfig?.usedMargin?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0.00'}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estimated Taxes & Brokerage</p>
                <p className="text-lg font-black text-amber-400">₹{((orders.length || 0) * 20 + ((orders.length || 0) * 5)).toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Positions */}
            <div className="flex-1 overflow-y-auto hide-scrollbar bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
              <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center justify-between">
                <span>Active Positions ({enrichedPositions.length})</span>
              </h3>
              {enrichedPositions.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center mt-4">No active positions.</p>
              ) : (
                <div className="space-y-2">
                  {enrichedPositions.map((p, i) => {
                    const invested = (p.quantity || 0) * (p.buyPrice || 0);
                    const currentVal = (p.quantity || 0) * (p.currentLTP || 0);
                    const approxBrokerage = 40; // ₹20 buy, ₹20 sell approx
                    return (
                    <div key={i} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-200">{p.symbol}</p>
                          <p className="text-[10px] text-slate-400">Qty: {p.quantity} • Avg: ₹{Number(p.buyPrice || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-white">₹{Number(p.currentLTP || 0).toFixed(2)}</p>
                          <p className={\`text-[11px] font-bold \${(p.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                            {(p.pnl || 0) >= 0 ? '+' : ''}{Number(p.pnl || 0).toFixed(2)} ({p.pnlPercent ? p.pnlPercent.toFixed(2) : '0.00'}%)
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-slate-800 pt-2 text-[9px] text-slate-400">
                         <div>Used Amt: <span className="text-slate-300">₹{invested.toFixed(2)}</span></div>
                         <div>Current: <span className="text-slate-300">₹{currentVal.toFixed(2)}</span></div>
                         <div>Est. Brokerage/Tax: <span className="text-amber-400/80">~₹{approxBrokerage.toFixed(2)}</span></div>
                      </div>
                    </div>
                    )}
                  )}
                </div>
              )}
            </div>
          </div>
        )}`
);

// Update nav buttons
// We replace the Orders & P&L button with two buttons: Portfolio and Orders

app = app.replace(
  /<button onClick=\{\(\) => setAppTab\('PORTFOLIO'\)\} className=\{\`flex flex-col items-center justify-center w-full h-full space-y-1 transition \$\{appTab === 'PORTFOLIO' \? 'text-teal-400' : 'text-slate-500 hover:text-slate-400'\}\`\}>\s*<Briefcase className="w-5 h-5" \/>\s*<span className="text-\[10px\] font-bold">Orders & P&L<\/span>\s*<\/button>/,
  `<button onClick={() => setAppTab('PORTFOLIO')} className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition \${appTab === 'PORTFOLIO' ? 'text-teal-400' : 'text-slate-500 hover:text-slate-400'}\`}>
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px] font-bold">Portfolio</span>
          </button>
          
          <button onClick={() => setAppTab('ORDERS')} className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition \${appTab === 'ORDERS' ? 'text-violet-400' : 'text-slate-500 hover:text-slate-400'}\`}>
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-bold">Orders</span>
          </button>`
);

// We need to make sure FileText is imported from lucide-react. Let's check imports.
if (!app.includes('FileText')) {
  app = app.replace(/import \{\s*Activity,\s*/, 'import {\n  Activity,\n  FileText,\n');
}

fs.writeFileSync('src/App.tsx', app);
console.log("Re-added Portfolio and Orders tab");
