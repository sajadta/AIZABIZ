const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldPositions = `{positions.map((p, i) => (
                    <div key={i} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{p.symbol}</p>
                        <p className="text-[10px] text-slate-400">Qty: {p.quantity} • Avg: ₹{Number(p.buyPrice || 0).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">₹{Number(p.currentLTP || 0).toFixed(2)}</p>
                        <p className={\`text-[11px] font-bold \${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                          {p.pnl >= 0 ? '+' : ''}{Number(p.pnl || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}`;

const newPositions = `{positions.map((p, i) => {
                    const invested = (p.quantity || 0) * (p.buyPrice || 0);
                    const currentVal = (p.quantity || 0) * (p.currentLTP || 0);
                    const approxBrokerage = 40; // ₹20 buy, ₹20 sell approx
                    return (
                    <div key={i} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-200">{p.symbol}</p>
                          <p className="text-[10px] text-slate-400">Qty: {p.quantity} • Avg: ₹{Number(p.buyPrice || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-white">₹{Number(p.currentLTP || 0).toFixed(2)}</p>
                          <p className={\`text-[11px] font-bold \${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                            {p.pnl >= 0 ? '+' : ''}{Number(p.pnl || 0).toFixed(2)} ({p.pnlPercent ? p.pnlPercent.toFixed(2) : '0.00'}%)
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-slate-800/60 pt-2 text-[9px] text-slate-400">
                         <div>Used Amt: <span className="text-slate-300">₹{invested.toFixed(2)}</span></div>
                         <div>Current: <span className="text-slate-300">₹{currentVal.toFixed(2)}</span></div>
                         <div>Est. Brokerage/Tax: <span className="text-amber-400/80">~₹{approxBrokerage.toFixed(2)}</span></div>
                      </div>
                    </div>
                  );})}`;

code = code.replace(oldPositions, newPositions);

const oldHoldings = `{holdings.map((h, i) => (
                    <div key={i} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{h.symbol}</p>
                        <p className="text-[10px] text-slate-400">Qty: {h.quantity} • Avg: ₹{Number(h.buyPrice || 0).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">₹{Number(h.currentLTP || 0).toFixed(2)}</p>
                        <p className={\`text-[11px] font-bold \${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                          {h.pnl >= 0 ? '+' : ''}{Number(h.pnl || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}`;

const newHoldings = `{holdings.map((h, i) => {
                    const invested = (h.quantity || 0) * (h.buyPrice || 0);
                    const currentVal = (h.quantity || 0) * (h.currentLTP || 0);
                    return (
                    <div key={i} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-200">{h.symbol}</p>
                          <p className="text-[10px] text-slate-400">Qty: {h.quantity} • Avg: ₹{Number(h.buyPrice || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-white">₹{Number(h.currentLTP || 0).toFixed(2)}</p>
                          <p className={\`text-[11px] font-bold \${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                            {h.pnl >= 0 ? '+' : ''}{Number(h.pnl || 0).toFixed(2)} ({h.pnlPercent ? h.pnlPercent.toFixed(2) : '0.00'}%)
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-slate-800/60 pt-2 text-[9px] text-slate-400">
                         <div>Invested Amt: <span className="text-slate-300">₹{invested.toFixed(2)}</span></div>
                         <div>Current Value: <span className="text-slate-300">₹{currentVal.toFixed(2)}</span></div>
                         <div>Est. Taxes (STT/Charges): <span className="text-amber-400/80">~₹{(invested * 0.001).toFixed(2)}</span></div>
                      </div>
                    </div>
                  );})}`;

code = code.replace(oldHoldings, newHoldings);
fs.writeFileSync('src/App.tsx', code);
console.log('Patched App.tsx Details');
