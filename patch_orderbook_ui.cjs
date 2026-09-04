const fs = require('fs');
let code = fs.readFileSync('src/components/OrderBookPositions.tsx', 'utf-8');

// Enhance PositionItem
code = code.replace(/<div className="bg-slate-900\/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\);\s*};/m, 
`<div className="bg-gradient-to-b from-slate-900 to-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col gap-3 relative overflow-hidden">
        {/* Glow effect for PNL */}
        <div className={\`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none \${net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}\`} />
        
        <div className="flex justify-between items-start z-10">
            <div>
                <div className="flex items-center gap-2 mb-1.5">
                    <span className={\`px-2 py-0.5 rounded text-[10px] font-black \${pos.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}\`}>
                        {pos.type}
                    </span>
                    <span className="font-extrabold text-white text-sm">{pos.symbol}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                    <span>Qty: <strong className="text-slate-200">{pos.quantity}</strong></span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span>LTP: <strong className="text-white">₹{pos.currentLTP?.toFixed(2)}</strong></span>
                </div>
            </div>
            <button 
                onClick={() => onSquareOff(pos.id)} 
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-rose-400 text-[11px] font-bold transition-all shadow-sm"
            >
                EXIT
            </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-black/40 p-3 rounded-xl border border-slate-800/50 z-10">
            <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Buy Price</span>
                <span className="text-slate-300 font-semibold">₹{pos.buyPrice?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Invested</span>
                <span className="text-slate-300 font-semibold">₹{invested.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Gross P&L</span>
                <span className={\`font-bold \${gross >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                    {gross >= 0 ? '+' : ''}₹{gross.toFixed(2)}
                </span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Net P&L {estCharges !== null ? \`(-₹\${estCharges.toFixed(2)})\` : '(Calc...)'}</span>
                <span className={\`font-black text-sm \${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                    {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
                </span>
            </div>
        </div>
      </div>
  );
};`);

// Enhance Orders List
code = code.replace(/<div\s*key=\{ord\.id\}\s*className="p-3 rounded-xl bg-slate-900\/80 border border-slate-800 flex items-center justify-between text-xs font-mono"\s*>[\s\S]*?<\/div>\s*<\/div>\s*\)\)\s*\)\}/m, 
`orders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between text-xs font-mono hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={\`px-2 py-1 rounded-md text-[10px] font-black w-12 text-center \${
                      ord.transactionType === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }\`}>
                      {ord.transactionType}
                    </span>
                    <div>
                      <span className="font-bold text-white font-sans text-sm">{ord.symbol}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-slate-500 text-[10px]">{ord.timestamp}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                        <span className="text-slate-400 text-[10px]">Qty: {ord.quantity}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-sm mb-0.5">
                      ₹{ord.executedPrice || ord.price}
                    </div>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{ord.status}</span>
                    </div>
                  </div>
                </div>
              ))
            )}`);

// Enhance Trade History
code = code.replace(/tradeHistory\.map\(\(pos\) => \{[\s\S]*?const gross =[\s\S]*?const estCharges =[\s\S]*?const net =[\s\S]*?return \([\s\S]*?<div key=\{pos\.id\} className="bg-slate-900\/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">[\s\S]*?<\/div>\s*\)\}\)\s*\)\}/m,
`tradeHistory.map((pos) => {
                const gross = (pos.realizedPnL || 0);
                const estCharges = 40; // Approx flat ₹40 for round trip
                const net = gross - estCharges;
                
                return (
                <div key={pos.id} className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3 relative overflow-hidden">
                  <div className={\`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none \${net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}\`} />
                  
                  <div className="flex justify-between items-start z-10">
                      <div>
                          <div className="flex items-center gap-2 mb-1.5">
                              <span className={\`px-2 py-0.5 rounded text-[10px] font-black \${pos.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}\`}>
                                  {pos.type}
                              </span>
                              <span className="font-extrabold text-white text-sm">{pos.symbol}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                              Qty: <strong className="text-slate-200">{pos.quantity}</strong>
                          </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-1 rounded-md border border-slate-800 uppercase tracking-wider">{pos.closeTime ? new Date(pos.closeTime).toLocaleTimeString() : 'CLOSED'}</span>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-black/30 p-3 rounded-xl border border-slate-800/40 z-10">
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Buy Price</span>
                          <span className="text-slate-300 font-semibold">₹{pos.buyPrice?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Sell Price</span>
                          <span className="text-slate-300 font-semibold">₹{pos.sellPrice?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Gross P&L</span>
                          <span className={\`font-bold \${gross >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                              {gross >= 0 ? '+' : ''}₹{gross.toFixed(2)}
                          </span>
                      </div>
                      <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-500 font-sans tracking-wide uppercase">Net P&L (-₹40 Tax)</span>
                          <span className={\`font-black text-sm \${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                              {net >= 0 ? '+' : ''}₹{net.toFixed(2)}
                          </span>
                      </div>
                  </div>
                </div>
              )})
            )}`);

// Final touch for the Day's PNL banner
code = code.replace(/<div className="mt-4 p-3 rounded-xl bg-slate-800\/50 border border-slate-700 flex justify-between items-center">\s*<span className="text-sm font-bold text-slate-300">Total Realized P&L \(Day\):<\/span>[\s\S]*?<\/div>/m,
`<div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 flex justify-between items-center shadow-lg">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-800 rounded-lg text-slate-300 border border-slate-700">
                        <Briefcase className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-extrabold text-slate-200">Total Realized P&L (Day)</span>
                 </div>
                 <span className={\`text-xl font-black px-4 py-2 rounded-xl bg-black/40 border border-slate-700/50 \${tradeHistory.reduce((a, b) => a + (b.realizedPnL || 0) - 40, 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                    {tradeHistory.reduce((a, b) => a + (b.realizedPnL || 0) - 40, 0) >= 0 ? '+' : ''}₹{tradeHistory.reduce((a, b) => a + (b.realizedPnL || 0) - 40, 0).toFixed(2)}
                 </span>
              </div>`);

fs.writeFileSync('src/components/OrderBookPositions.tsx', code);
console.log("Patched UI in OrderBookPositions.tsx");
