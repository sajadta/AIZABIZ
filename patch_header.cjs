const fs = require('fs');
let code = fs.readFileSync('src/components/Header.tsx', 'utf-8');

// Add dailyProfit to HeaderProps
code = code.replace(/totalPnL: number;\n}/, "totalPnL: number;\n  dailyProfit: number;\n}");

// Add dailyProfit to Header component destructured arguments
code = code.replace(/totalPnL,\n  isWsConnected,/, "totalPnL,\n  dailyProfit,\n  isWsConnected,");

// Update the PnL Badge section
const oldBadge = `{activePositionsCount > 0 && (
            <div className={\`hidden md:flex items-center gap-2 px-3 py-1 rounded-xl border font-mono text-xs font-bold \${
              totalPnL >= 0 
                 ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
                 : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
            }\`}>
              <span className="text-slate-400 text-[10px] uppercase font-sans">MTM:</span>
              <span>{totalPnL >= 0 ? \`+₹\${totalPnL.toFixed(2)}\` : \`-₹\${Math.abs(totalPnL).toFixed(2)}\`}</span>
              <button
                onClick={onSquareOffAll}
                title="Panic Exit All Positions"
                className="ml-1 p-1 hover:bg-rose-500/20 text-rose-400 rounded transition"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}`;

const newBadge = `<div className="hidden md:flex items-center gap-2">
            <div className={\`flex items-center gap-2 px-3 py-1 rounded-xl border font-mono text-xs font-bold \${
                dailyProfit >= 0 
                 ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
                 : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
            }\`}>
              <span className="text-slate-400 text-[10px] uppercase font-sans" title="Total Realized Profit (Day)">Day P&L:</span>
              <span>{dailyProfit >= 0 ? \`+₹\${dailyProfit.toFixed(2)}\` : \`-₹\${Math.abs(dailyProfit).toFixed(2)}\`}</span>
            </div>

            {activePositionsCount > 0 && (
              <div className={\`flex items-center gap-2 px-3 py-1 rounded-xl border font-mono text-xs font-bold \${
                totalPnL >= 0 
                   ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400' 
                   : 'bg-rose-950/40 border-rose-800/50 text-rose-400'
              }\`}>
                <span className="text-slate-400 text-[10px] uppercase font-sans" title="Mark-to-Market (Open Positions)">MTM:</span>
                <span>{totalPnL >= 0 ? \`+₹\${totalPnL.toFixed(2)}\` : \`-₹\${Math.abs(totalPnL).toFixed(2)}\`}</span>
                <button
                  onClick={onSquareOffAll}
                  title="Panic Exit All Positions"
                  className="ml-1 p-1 hover:bg-rose-500/20 text-rose-400 rounded transition"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>`;

if(code.includes('MTM:')) {
  // Use index matching
  const idx = code.indexOf('{activePositionsCount > 0 && (');
  const endIdx = code.indexOf(')}', idx + 500) + 2;
  const toReplace = code.substring(idx, endIdx);
  code = code.replace(toReplace, newBadge);
  fs.writeFileSync('src/components/Header.tsx', code);
  console.log("Patched Header.tsx");
}
