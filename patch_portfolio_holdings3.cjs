const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldStr = `{/* Positions */}
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
            </div>`;

const newStr = `{/* Holdings */}
            <div className="flex-1 overflow-y-auto hide-scrollbar bg-slate-900/80 border border-slate-800 rounded-2xl p-3">
              <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center justify-between">
                <span>{language === 'ml' ? 'നിങ്ങളുടെ ഇൻവെസ്റ്റ്മെന്റുകൾ (Holdings)' : 'Long-Term Holdings'} ({enrichedHoldings.length})</span>
              </h3>
              {enrichedHoldings.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center mt-4">
                   {language === 'ml' ? 'പോർട്ട്‌ഫോളിയോയിൽ സ്റ്റോക്കുകൾ ഒന്നുമില്ല.' : 'No long-term holdings found.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {enrichedHoldings.map((h, i) => {
                    const invested = (h.quantity || 0) * (h.buyPrice || 0);
                    const currentVal = (h.quantity || 0) * (h.currentLTP || 0);
                    return (
                    <div key={i} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold text-slate-200">{h.symbol}</p>
                          <p className="text-[10px] text-slate-400">Qty: {h.quantity} • Avg: ₹{Number(h.buyPrice || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-white">₹{Number(h.currentLTP || 0).toFixed(2)}</p>
                          <p className={\`text-[11px] font-bold \${(h.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                            {(h.pnl || 0) >= 0 ? '+' : ''}{Number(h.pnl || 0).toFixed(2)} ({h.pnlPercent ? h.pnlPercent.toFixed(2) : '0.00'}%)
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-slate-800 pt-2 text-[9px] text-slate-400">
                         <div>Invested: <span className="text-slate-300">₹{invested.toFixed(2)}</span></div>
                         <div>Current Value: <span className="text-slate-300">₹{currentVal.toFixed(2)}</span></div>
                      </div>
                    </div>
                    )}
                  )}
                </div>
              )}
            </div>`;

const index = code.indexOf(oldStr);
if (index !== -1) {
    code = code.substring(0, index) + newStr + code.substring(index + oldStr.length);
    fs.writeFileSync('src/App.tsx', code);
    console.log("Success exact matching");
} else {
    // If spaces mismatch, let's just do a manual slice using the text from exact_text.txt
    const exact = fs.readFileSync('exact_text.txt', 'utf-8').trim();
    const idx2 = code.indexOf(exact);
    if (idx2 !== -1) {
        code = code.substring(0, idx2) + newStr + code.substring(idx2 + exact.length);
        fs.writeFileSync('src/App.tsx', code);
        console.log("Success exact file matching");
    } else {
        console.log("Still not found...");
    }
}
