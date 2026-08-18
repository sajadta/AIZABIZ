const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add appTab state
code = code.replace(
  'const [bottomTab, setBottomTab] = useState',
  'const [appTab, setAppTab] = useState<\'MARKETS\' | \'BOT\' | \'OPTIONS\' | \'PORTFOLIO\' | \'AI\'>(\'MARKETS\');\n  const [bottomTab, setBottomTab] = useState'
);

// We'll replace the main section and footer.
const regexMain = /<main className="flex-1 p-2 sm:p-4 max-w-\[1720px\] w-full mx-auto space-y-4">[\s\S]*?<footer className="bg-\[#090d16\] border-t border-slate-800\/80 py-3 px-4 text-center text-xs text-slate-500 font-mono">[\s\S]*?<\/footer>/;

const newMain = `<main className="flex-1 overflow-y-auto hide-scrollbar pb-20 w-full">
        <div className="p-2 sm:p-4 max-w-md mx-auto space-y-4">
        
        {/* Daily Token Alert Banner for Live Mode */}
        {mode === 'UPSTOX_LIVE' && !apiConfig.isConnected && (
          <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900/40 border border-amber-500/40 flex items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in flex-wrap">
            <div className="flex items-center gap-2.5 text-amber-200 font-medium">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-amber-300 block text-xs">
                  {language === 'ml' ? 'ടോക്കൺ നൽകുക' : 'Token Required'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsApiModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-[10px] transition shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-950 active:scale-95"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{language === 'ml' ? 'നൽകുക' : 'Enter'}</span>
            </button>
          </div>
        )}
        
        {appTab === 'MARKETS' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="h-[340px]">
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
            <div className="h-[400px]">
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

        {appTab === 'BOT' && (
          <div className="h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <AlgoBotPanel
              botConfig={botConfig}
              onUpdateBotConfig={handleUpdateBotConfig}
              botLogs={botLogs}
              signals={signals}
              language={language}
              onExecuteSignal={(sig) => openOrderModal(sig.signalType as OrderTransactionType, sig.symbol, sig.price)}
            />
          </div>
        )}

        {appTab === 'OPTIONS' && (
          <div className="h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <OptionChainPanel
              data={optionChain}
              loading={optionChainLoading}
              onRefresh={() => fetchOptionChain(selectedSymbol)}
              language={language}
              onSelectOptionTrade={openOrderModal}
            />
          </div>
        )}

        {appTab === 'PORTFOLIO' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col h-[600px]">
            {/* Margin Cards */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Available Margin</p>
                <p className="text-lg font-black text-emerald-400">₹{apiConfig?.availableMargin?.toLocaleString('en-IN') || '0.00'}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Used Margin</p>
                <p className="text-lg font-black text-rose-400">₹{apiConfig?.usedMargin?.toLocaleString('en-IN') || '0.00'}</p>
              </div>
            </div>

            {/* Positions */}
            <div className="flex-1 overflow-y-auto hide-scrollbar bg-[#0b0f19] border border-slate-800 rounded-2xl p-3">
              <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center justify-between">
                <span>Active Positions ({positions.length})</span>
              </h3>
              {positions.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center mt-4">No active positions.</p>
              ) : (
                <div className="space-y-2">
                  {positions.map((p, i) => (
                    <div key={i} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{p.symbol}</p>
                        <p className="text-[10px] text-slate-400">Qty: {p.quantity} • Avg: ₹{Number(p.buyPrice).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">₹{Number(p.currentLTP).toFixed(2)}</p>
                        <p className={\`text-[11px] font-bold \${p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}\`}>
                          {p.pnl >= 0 ? '+' : ''}{Number(p.pnl).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Holdings */}
            <div className="flex-1 overflow-y-auto hide-scrollbar bg-[#0b0f19] border border-slate-800 rounded-2xl p-3">
              <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center justify-between">
                <span>Long-term Holdings ({holdings.length})</span>
              </h3>
              {holdings.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center mt-4">No holdings found.</p>
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
                          {h.pnl >= 0 ? '+' : ''}{Number(h.pnl).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {appTab === 'AI' && (
          <div className="h-[600px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <GeminiAiAdvisor
              analysis={geminiAnalysis}
              loading={aiLoading}
              onRefreshAnalysis={runGeminiAnalysis}
              language={language}
              symbol={selectedSymbol}
            />
          </div>
        )}
        
        </div>
      </main>

      {/* App Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full bg-[#0a0e17]/95 backdrop-blur-md border-t border-slate-800/80 pb-safe z-50">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
          <button onClick={() => setAppTab('MARKETS')} className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition \${appTab === 'MARKETS' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-400'}\`}>
            <Activity className="w-5 h-5" />
            <span className="text-[10px] font-bold">Markets</span>
          </button>
          
          <button onClick={() => setAppTab('BOT')} className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition \${appTab === 'BOT' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-400'}\`}>
            <Terminal className="w-5 h-5" />
            <span className="text-[10px] font-bold">Algo Bot</span>
          </button>

          <button onClick={() => setAppTab('OPTIONS')} className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition \${appTab === 'OPTIONS' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-400'}\`}>
            <Layers className="w-5 h-5" />
            <span className="text-[10px] font-bold">Options</span>
          </button>

          <button onClick={() => setAppTab('PORTFOLIO')} className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition \${appTab === 'PORTFOLIO' ? 'text-teal-400' : 'text-slate-500 hover:text-slate-400'}\`}>
            <Briefcase className="w-5 h-5" />
            <span className="text-[10px] font-bold">Portfolio</span>
          </button>

          <button onClick={() => setAppTab('AI')} className={\`flex flex-col items-center justify-center w-full h-full space-y-1 transition \${appTab === 'AI' ? 'text-purple-400' : 'text-slate-500 hover:text-slate-400'}\`}>
            <Cpu className="w-5 h-5" />
            <span className="text-[10px] font-bold">AI</span>
          </button>
        </div>
      </nav>`;

code = code.replace(regexMain, newMain);

// Add missing icon imports
if (!code.includes('Briefcase')) {
  code = code.replace('Cpu,', 'Cpu, Briefcase, Layers, Activity,');
}

fs.writeFileSync('src/App.tsx', code);
