const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const anchor = `<GeminiAiAdvisor
                  analysis={geminiAnalysis}
                  loading={aiLoading}
                  onRefreshAnalysis={runGeminiAnalysis}
                  language={language}
                  symbol={selectedSymbol}
                />
              )}`;

const replacement = `<GeminiAiAdvisor
                  analysis={geminiAnalysis}
                  loading={aiLoading}
                  onRefreshAnalysis={runGeminiAnalysis}
                  language={language}
                  symbol={selectedSymbol}
                />
              )}

              {bottomTab === 'PORTFOLIO' && (
                <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl flex-1 overflow-hidden flex flex-col p-4 animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                    Portfolio & Available Margin
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Available Margin</p>
                      <p className="text-lg font-black text-emerald-400">₹{apiConfig?.availableMargin?.toLocaleString('en-IN') || '0.00'}</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Used Margin</p>
                      <p className="text-lg font-black text-rose-400">₹{apiConfig?.usedMargin?.toLocaleString('en-IN') || '0.00'}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0">
                    {holdings.length === 0 ? (
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
                    )}
                  </div>
                </div>
              )}`;

code = code.replace(anchor, replacement);
fs.writeFileSync('src/App.tsx', code);
