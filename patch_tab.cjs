const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const tabBtn = `
              <button
                onClick={() => setBottomTab('PORTFOLIO')}
                className={\`flex-1 py-1.5 rounded-xl transition \${
                  bottomTab === 'PORTFOLIO'
                    ? 'bg-slate-800 text-teal-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }\`}
              >
                Funds & Holdings
              </button>
`;

code = code.replace('{t.optionChain}\n              </button>', '{t.optionChain}\n              </button>' + tabBtn);

const newTabContent = `
              {bottomTab === 'PORTFOLIO' && (
                <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl flex-1 overflow-hidden flex flex-col p-4 animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                    Portfolio & Available Margin
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Available Margin</p>
                      <p className="text-lg font-black text-emerald-400">₹{apiConfig.availableMargin?.toLocaleString('en-IN') || '0.00'}</p>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Used Margin</p>
                      <p className="text-lg font-black text-rose-400">₹{apiConfig.usedMargin?.toLocaleString('en-IN') || '0.00'}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
                    <p className="text-xs text-slate-400 italic text-center mt-4">Holdings will be automatically fetched when active trades are generated via Live Upstox engine.</p>
                  </div>
                </div>
              )}
`;

code = code.replace('{/* END BOTTOM TABS CONTENT */}', newTabContent + '\n              {/* END BOTTOM TABS CONTENT */}');

fs.writeFileSync('src/App.tsx', code);
