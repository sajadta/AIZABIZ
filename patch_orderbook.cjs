const fs = require('fs');
let code = fs.readFileSync('src/components/OrderBookPositions.tsx', 'utf-8');

// Add TRADE_HISTORY to the tab renders
const tradeHistoryTab = `
        {/* TRADE HISTORY TAB */}
        {activeTab === 'TRADE_HISTORY' && (
          <div className="space-y-2">
            {tradeHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                <p className="text-xs font-semibold">
                  {language === 'ml' ? 'ഇന്ന് പൂർത്തിയാക്കിയ ട്രേഡുകൾ ഒന്നുമില്ല.' : 'No completed trades for today.'}
                </p>
              </div>
            ) : (
              tradeHistory.map((pos) => {
                const gross = (pos.realizedPnL || 0);
                const estCharges = 40; // Approx flat ₹40 for round trip
                const net = gross - estCharges;
                
                return (
                <div key={pos.id} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                      <div>
                          <div className="flex items-center gap-1.5 mb-1">
                              <span className={\`px-1.5 py-0.5 rounded text-[9px] font-black \${pos.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}\`}>
                                  {pos.type}
                              </span>
                              <span className="font-bold text-white text-xs">{pos.symbol}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                              Qty: <strong className="text-slate-200">{pos.quantity}</strong>
                          </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-slate-500">{pos.closeTime ? new Date(pos.closeTime).toLocaleTimeString() : ''}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Closed</span>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/30">
                      <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500">Buy Price</span>
                          <span className="text-slate-400">₹{pos.buyPrice?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500">Sell Price</span>
                          <span className="text-slate-400">₹{pos.sellPrice?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500">Gross P&L</span>
                          <span className={\`font-semibold \${gross >= 0 ? 'text-emerald-500' : 'text-rose-500'}\`}>
                              {gross >= 0 ? '+' : ''}₹{gross.toFixed(2)}
                          </span>
                      </div>
                      <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500">Net P&L (-₹40 Tax)</span>
                          <span className={\`font-bold \${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                              {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
                          </span>
                      </div>
                  </div>
                </div>
              )})
            )}
            
            {tradeHistory.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700 flex justify-between items-center">
                 <span className="text-sm font-bold text-slate-300">Total Realized P&L (Day):</span>
                 <span className={\`text-lg font-black \${tradeHistory.reduce((a, b) => a + (b.realizedPnL || 0) - 40, 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                    {tradeHistory.reduce((a, b) => a + (b.realizedPnL || 0) - 40, 0) >= 0 ? '+' : ''}₹{tradeHistory.reduce((a, b) => a + (b.realizedPnL || 0) - 40, 0).toFixed(2)}
                 </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
`

code = code.replace(/\{\/\* ORDERS TAB \*\/\}([\s\S]*?)<\/div>\s*<\/div>\s*\)\;\s*\}\;/m, 
  `{/* ORDERS TAB */}$1${tradeHistoryTab}`);

fs.writeFileSync('src/components/OrderBookPositions.tsx', code);
console.log("Patched OrderBookPositions.tsx");
