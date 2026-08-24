const fs = require('fs');
let code = fs.readFileSync('src/components/OptionChainView.tsx', 'utf8');

code = code.replace(
  "onSelectOptionTrade: (type: 'BUY' | 'SELL', optionSymbol: string, price: number) => void;",
  "onSelectOptionTrade: (type: 'BUY' | 'SELL', optionSymbol: string, price: number) => void;\n  onViewChart?: (symbol: string, instrumentKey: string) => void;"
);

code = code.replace(
  "onSelectOptionTrade,",
  "onSelectOptionTrade,\n  onViewChart,"
);

// We need to add chart icons next to the strike or just next to LTP. Let's add a small LineChart icon next to the options symbol text or something.
// Actually, let's just make the whole LTP clickable for trade, and add a small "chart" button.
// Or we can just import LineChart from lucide-react and add it.
code = code.replace(
  "import { Layers, Activity, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';",
  "import { Layers, Activity, TrendingUp, TrendingDown, RefreshCw, LineChart } from 'lucide-react';"
);

const oldCall = `<td className={\`py-1.5 px-2 text-right font-bold text-emerald-400 border-r border-slate-800 cursor-pointer hover:underline \${isITMCall ? 'bg-emerald-950/15' : ''}\`}
                    onClick={() => onSelectOptionTrade('BUY', \`\${data.underlyingSymbol} \${s.strikePrice} CE\`, s.callLTP)}
                  >
                    ₹{Number(s.callLTP || 0).toFixed(1)}
                  </td>`;

const newCall = `<td className={\`py-1.5 px-2 text-right font-bold text-emerald-400 border-r border-slate-800 \${isITMCall ? 'bg-emerald-950/15' : ''}\`}>
                    <div className="flex items-center justify-end gap-2">
                       <span className="cursor-pointer hover:underline" onClick={() => onSelectOptionTrade('BUY', \`\${data.underlyingSymbol} \${s.strikePrice} CE\`, s.callLTP)}>₹{Number(s.callLTP || 0).toFixed(1)}</span>
                       {onViewChart && <LineChart className="w-3.5 h-3.5 text-slate-500 hover:text-emerald-400 cursor-pointer" onClick={(e) => { e.stopPropagation(); onViewChart(\`\${data.underlyingSymbol} \${s.strikePrice} CE\`, s.callInstrumentKey); }} />}
                    </div>
                  </td>`;

code = code.replace(oldCall, newCall);

const oldPut = `<td className={\`py-1.5 px-2 text-left font-bold text-rose-400 cursor-pointer hover:underline \${isITMPut ? 'bg-rose-950/15' : ''}\`}
                    onClick={() => onSelectOptionTrade('BUY', \`\${data.underlyingSymbol} \${s.strikePrice} PE\`, s.putLTP)}
                  >
                    ₹{Number(s.putLTP || 0).toFixed(1)}
                  </td>`;

const newPut = `<td className={\`py-1.5 px-2 text-left font-bold text-rose-400 \${isITMPut ? 'bg-rose-950/15' : ''}\`}>
                    <div className="flex items-center justify-start gap-2">
                       {onViewChart && <LineChart className="w-3.5 h-3.5 text-slate-500 hover:text-rose-400 cursor-pointer" onClick={(e) => { e.stopPropagation(); onViewChart(\`\${data.underlyingSymbol} \${s.strikePrice} PE\`, s.putInstrumentKey); }} />}
                       <span className="cursor-pointer hover:underline" onClick={() => onSelectOptionTrade('BUY', \`\${data.underlyingSymbol} \${s.strikePrice} PE\`, s.putLTP)}>₹{Number(s.putLTP || 0).toFixed(1)}</span>
                    </div>
                  </td>`;

code = code.replace(oldPut, newPut);

fs.writeFileSync('src/components/OptionChainView.tsx', code);
console.log('Patched OptionChainView.tsx');
