const fs = require('fs');

// Update backend fallback quotes to include 6 indices
let serverCode = fs.readFileSync('server.ts', 'utf8');
const indicesFallback = `
      { symbol: 'NIFTY 50', name: 'Nifty 50', ltp: 24500.5, change: 100, changePercent: 0.4, segment: 'INDEX' },
      { symbol: 'NIFTY BANK', name: 'Bank Nifty', ltp: 52000.2, change: -150, changePercent: -0.3, segment: 'INDEX' },
      { symbol: 'NIFTY FIN SERVICE', name: 'Fin Nifty', ltp: 23100.0, change: 25, changePercent: 0.1, segment: 'INDEX' },
      { symbol: 'NIFTY MID SELECT', name: 'Midcap Nifty', ltp: 12500.0, change: 80, changePercent: 0.6, segment: 'INDEX' },
      { symbol: 'SENSEX', name: 'BSE Sensex', ltp: 80500.0, change: 300, changePercent: 0.38, segment: 'INDEX' },
      { symbol: 'BANKEX', name: 'BSE Bankex', ltp: 58000.0, change: -200, changePercent: -0.34, segment: 'INDEX' },
      { symbol: 'RELIANCE', name: 'Reliance Ind', ltp: 3100.0, change: 15, changePercent: 0.5, segment: 'EQUITY' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank', ltp: 1650.0, change: 5, changePercent: 0.3, segment: 'EQUITY' }
`;
serverCode = serverCode.replace(/\{\s*symbol:\s*'NIFTY 50'[\s\S]*?\{\s*symbol:\s*'HDFCBANK'[^}]*\}\s*\]/m, indicesFallback.trim() + "\n    ]");

fs.writeFileSync('server.ts', serverCode);

// Add the 6 index multi-chart view and auto-refresh to App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Auto-fetch candles on interval
const newIntervalLogic = `
    const tradingInterval = window.setInterval(() => { fetchPositionsAndOrders(); fetchApiConfig(); }, 3000);
    const botInterval = window.setInterval(fetchBotState, 2000);
    const chartInterval = window.setInterval(() => { fetchCandles(selectedSymbol, interval); }, 10000);

    return () => {
      window.clearInterval(quoteInterval);
      window.clearInterval(tradingInterval);
      window.clearInterval(botInterval);
      window.clearInterval(chartInterval);
    };
`;
appCode = appCode.replace(/const tradingInterval = window\.setInterval[\s\S]*?window\.clearInterval\(botInterval\);\s*\};\s*\}, \[/m, newIntervalLogic + "\n  }, [");


// 2. Add Multi-chart layout
const multiChartState = `
  const [appTab, setAppTab] = useState<'MARKETS' | 'BOT' | 'OPTIONS' | 'PORTFOLIO' | 'SUPPORT'>('MARKETS');
  const [marketView, setMarketView] = useState<'SINGLE' | 'GRID'>('SINGLE');
`;
appCode = appCode.replace("const [appTab, setAppTab] = useState<'MARKETS' | 'BOT' | 'OPTIONS' | 'PORTFOLIO' | 'SUPPORT'>('MARKETS');", multiChartState);

// Add 6 Chart Grid View in MARKETS
const gridViewUi = `
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
                  const q = safeQuotes.find(x => x.symbol === sym) || { ltp: 0, changePercent: 0 };
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

appCode = appCode.replace(/\{appTab === 'MARKETS' && \([\s\S]*?<\/Watchlist>\s*<\/div>\s*<\/div>\s*\)\}/, gridViewUi);

fs.writeFileSync('src/App.tsx', appCode);

