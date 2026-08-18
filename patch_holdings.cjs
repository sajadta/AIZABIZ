const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add state for holdings
code = code.replace(
  'const [positions, setPositions] = useState<Position[]>([]);',
  'const [positions, setPositions] = useState<Position[]>([]);\n  const [holdings, setHoldings] = useState<any[]>([]);'
);

// Add fetch inside fetchPositionsAndOrders
const oldFetch = `      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(Array.isArray(ordData) ? ordData : (ordData.orders || []));
      }`;
const newFetch = `      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(Array.isArray(ordData) ? ordData : (ordData.orders || []));
      }
      
      const holdRes = await fetch('/api/upstox/holdings');
      if (holdRes.ok) {
        setHoldings(await holdRes.json());
      }`;
code = code.replace(oldFetch, newFetch);

// Update Portfolio tab display
const oldPortfolioMsg = '<p className="text-xs text-slate-400 italic text-center mt-4">Holdings will be automatically fetched when active trades are generated via Live Upstox engine.</p>';
const newPortfolioMsg = `{holdings.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center mt-4">No long-term holdings found in this Upstox account.</p>
                    ) : (
                      <div className="space-y-2">
                        {holdings.map((h, i) => (
                          <div key={i} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                            <div>
                              <p className="text-xs font-bold text-slate-200">{h.symbol}</p>
                              <p className="text-[10px] text-slate-400">Qty: {h.quantity} • Avg: ₹{Number(h.buyPrice).toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-white">₹{Number(h.currentLTP).toFixed(2)}</p>
                              <p className={\`text-[11px] font-bold \${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                                {h.pnl >= 0 ? '+' : ''}{Number(h.pnl).toFixed(2)} ({Number(h.pnlPercent).toFixed(2)}%)
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}`;
code = code.replace(oldPortfolioMsg, newPortfolioMsg);

fs.writeFileSync('src/App.tsx', code);
