const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<div className="flex-1 flex flex-col bg\[#070a12\]">[\s\S]*?<div className="flex-1 p-2 relative">[\s\S]*?<CandlestickChart[\s\S]*?\/>\s*<\/div>\s*<\/div>/;

const replacementHtml = `<div className="flex-1 flex flex-col bg-[#070a12] min-h-[500px]">
              <div className="p-2 border-b border-slate-800/50 flex justify-end space-x-2 bg-slate-900/40">
                 <button onClick={() => setMarketView('SINGLE')} className={\`px-3 py-1.5 text-xs font-medium rounded-md transition-colors \${marketView === 'SINGLE' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}\`}>Chart View</button>
                 <button onClick={() => setMarketView('GRID')} className={\`px-3 py-1.5 text-xs font-medium rounded-md transition-colors \${marketView === 'GRID' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}\`}>Heatmap View</button>
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

code = code.replace(regex, replacementHtml);
fs.writeFileSync('src/App.tsx', code);
