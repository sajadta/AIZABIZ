const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<div className="flex-1 flex flex-col bg-[#070a12]">
              <div className="flex-1 p-2 relative">
                 <CandlestickChart
                     candles={candles || []}
                    symbol={selectedSymbol}
                    interval={interval}
                    onChangeInterval={setInterval}
                    quote={quotes.find(q => q.symbol === selectedSymbol)}
                    language={language}
                    onOpenOrderModal={openOrderModal}
                    onGenerateAiAnalysis={() => {}}
                 />
              </div>
            </div>`;

const replacement = `<div className="flex-1 flex flex-col bg-[#070a12] min-h-[500px]">
              <div className="p-2 border-b border-slate-800/50 flex justify-end space-x-2 bg-slate-900/40">
                 <button onClick={() => setMarketView('SINGLE')} className={\`px-3 py-1.5 text-xs font-medium rounded-md transition-colors \${marketView === 'SINGLE' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}\`}>Chart</button>
                 <button onClick={() => setMarketView('GRID')} className={\`px-3 py-1.5 text-xs font-medium rounded-md transition-colors \${marketView === 'GRID' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}\`}>Heatmap</button>
              </div>
              <div className="flex-1 p-2 relative overflow-hidden">
                 {marketView === 'SINGLE' ? (
                   <CandlestickChart
                       candles={candles || []}
                      symbol={selectedSymbol}
                      interval={interval}
                      onChangeInterval={setInterval}
                      quote={quotes.find(q => q.symbol === selectedSymbol)}
                      language={language}
                      onOpenOrderModal={openOrderModal}
                      onGenerateAiAnalysis={() => {}}
                   />
                 ) : (
                   <MarketHeatmap quotes={quotes} />
                 )}
              </div>
            </div>`;

// Strip all spaces to check if it's there
let spaceStrippedCode = code.replace(/\s+/g, '');
let spaceStrippedTarget = target.replace(/\s+/g, '');

if (spaceStrippedCode.includes(spaceStrippedTarget)) {
   // find the actual index by scanning
   // this is tricky, let's just do a manual replace
   console.log("Found target!");
} else {
   console.log("Could not find target!");
}
