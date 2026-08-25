const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldPortfolio = `{/* Margin Cards */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Available Margin</p>
                <p className="text-lg font-black text-emerald-400">₹{apiConfig?.availableMargin?.toLocaleString('en-IN') || '0.00'}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Used Margin</p>
                <p className="text-lg font-black text-rose-400">₹{apiConfig?.usedMargin?.toLocaleString('en-IN') || '0.00'}</p>
              </div>
            </div>`;

const newPortfolio = `{/* Margin Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Account Balance</p>
                <p className="text-lg font-black text-white">₹{((apiConfig?.availableMargin || 0) + (apiConfig?.usedMargin > 0 ? apiConfig.usedMargin : 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Available Margin</p>
                <p className="text-lg font-black text-emerald-400">₹{apiConfig?.availableMargin?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0.00'}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Used Margin (Active)</p>
                <p className="text-lg font-black text-rose-400">₹{apiConfig?.usedMargin?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0.00'}</p>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estimated Taxes & Brokerage</p>
                <p className="text-lg font-black text-amber-400">₹{((orders.length || 0) * 20 + ((orders.length || 0) * 5)).toLocaleString('en-IN')}</p>
              </div>
            </div>`;

code = code.replace(oldPortfolio, newPortfolio);

fs.writeFileSync('src/App.tsx', code);
console.log('Patched App.tsx for Portfolio');
