const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `
        {appTab === 'MARKETS' && marketView === 'SINGLE' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex justify-end px-2">
               <button onClick={() => setMarketView('GRID')} className="text-xs bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-emerald-400 font-bold shadow-md">
                 6 Index Grid View
               </button>
            </div>
            <div className="h-[45vh] min-h-[340px]">
              <CandlestickChart
                symbol={selectedSymbol}
                quote={currentQuote}
                candles={candles}
                interval={interval}
                onChangeInterval={setInterval}
                language={language}
                onOpenOrderModal={openOrderModal}
                onGenerateAiAnalysis={runGeminiAnalysis}
                aiLoading={aiLoading}
                signal={activeSignal}
              />
            </div>
            <div className="flex-1 min-h-[400px]">
              <Watchlist
                quotes={quotes}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={setSelectedSymbol}
                language={language}
                onOpenOrderModal={openOrderModal}
              />
            </div>
          </div>
        )}

        {appTab === 'MARKETS' && marketView === 'GRID' && (
           <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex justify-between items-center px-2">
               <h2 className="text-sm font-bold text-white">Live Index Grid</h2>
               <button onClick={() => setMarketView('SINGLE')} className="text-xs bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg text-amber-400 font-bold shadow-md">
                 Single Chart View
               </button>
            </div>
            <div className="grid grid-cols-2 gap-3 pb-6">
               {['NIFTY 50', 'NIFTY BANK', 'NIFTY FIN SERVICE', 'NIFTY MID SELECT', 'SENSEX', 'BANKEX'].map(sym => {
                  const q = quotes.find(x => x.symbol === sym) || { ltp: 0, changePercent: 0 };
                  const color = q.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400';
                  const isUp = q.changePercent >= 0;
                  return (
                     <div key={sym} onClick={() => { setSelectedSymbol(sym); setMarketView('SINGLE'); }} className="bg-[#0b0f19] border border-slate-800 rounded-xl p-3 cursor-pointer hover:border-slate-600 transition shadow-lg">
                        <div className="flex justify-between items-start mb-2">
                           <h3 className="text-[10px] sm:text-xs font-black text-slate-300 w-[65%] leading-tight">{sym}</h3>
                           <span className={\`text-[10px] font-bold px-1.5 py-0.5 rounded \${isUp ? 'bg-emerald-950/40 text-emerald-400' : 'bg-rose-950/40 text-rose-400'}\`}>
                              {isUp ? '+' : ''}{q.changePercent.toFixed(2)}%
                           </span>
                        </div>
                        <div className={\`text-lg font-black \${color}\`}>
                           ₹{q.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="h-20 mt-3 relative overflow-hidden rounded border border-slate-800/50 bg-[#070a14]">
                           {/* Decorative Mini Sparkline */}
                           <div className="absolute inset-0 flex items-end">
                              {Array.from({ length: 20 }).map((_, i) => (
                                 <div key={i} className={\`w-full mx-[1px] rounded-t-sm \${isUp ? 'bg-emerald-500/20' : 'bg-rose-500/20'}\`} style={{ height: \`\${Math.random() * 80 + 20}%\` }} />
                              ))}
                           </div>
                        </div>
                     </div>
                  );
               })}
            </div>
           </div>
        )}
`;

code = code.replace(
  /\{appTab === 'MARKETS' && \([\s\S]*?<\/Watchlist>\s*<\/div>\s*<\/div>\s*\)\}/,
  replacement.trim()
);

fs.writeFileSync('src/App.tsx', code);
