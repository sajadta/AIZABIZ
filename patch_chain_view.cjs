const fs = require('fs');
let code = fs.readFileSync('src/components/OptionChainView.tsx', 'utf8');

const oldHeader = `              <th className="py-1 px-2 text-right">OI (k)</th>
              <th className="py-1 px-2 text-right">IV</th>
              <th className="py-1 px-2 text-right border-r border-slate-800 text-emerald-400 font-bold">LTP</th>
              <th className="py-1 px-2 text-center bg-slate-900 text-slate-300 border-r border-slate-800">Price</th>
              <th className="py-1 px-2 text-left text-rose-400 font-bold">LTP</th>
              <th className="py-1 px-2 text-left">IV</th>
              <th className="py-1 px-2 text-left">OI (k)</th>`;

const newHeader = `              <th className="py-1 px-2 text-right">Vol (k)</th>
              <th className="py-1 px-2 text-right">OI (k)</th>
              <th className="py-1 px-2 text-right">IV</th>
              <th className="py-1 px-2 text-right border-r border-slate-800 text-emerald-400 font-bold">LTP</th>
              <th className="py-1 px-2 text-center bg-slate-900 text-slate-300 border-r border-slate-800">Price</th>
              <th className="py-1 px-2 text-left text-rose-400 font-bold">LTP</th>
              <th className="py-1 px-2 text-left">IV</th>
              <th className="py-1 px-2 text-left">OI (k)</th>
              <th className="py-1 px-2 text-left">Vol (k)</th>`;

code = code.replace(oldHeader, newHeader);

const oldRowStart = `<td className={\`py-1.5 px-2 text-right text-slate-500 \${isITMCall ? 'bg-emerald-950/15' : ''}\`}>
                    {s.callOI}
                  </td>
                  <td className={\`py-1.5 px-2 text-right text-slate-500 \${isITMCall ? 'bg-emerald-950/15' : ''}\`}>
                    {s.callIV}%
                  </td>
                  <td className={\`py-1.5 px-2 text-right font-bold text-emerald-400 border-r border-slate-800 \${isITMCall ? 'bg-emerald-950/15' : ''}\`}>`;

const newRowStart = `<td className={\`py-1.5 px-2 text-right text-slate-500 \${isITMCall ? 'bg-emerald-950/15' : ''}\`}>
                    {(s.callVolume / 1000).toFixed(1)}
                  </td>
                  <td className={\`py-1.5 px-2 text-right text-slate-500 \${isITMCall ? 'bg-emerald-950/15' : ''}\`}>
                    {(s.callOI / 1000).toFixed(1)}
                  </td>
                  <td className={\`py-1.5 px-2 text-right text-slate-500 \${isITMCall ? 'bg-emerald-950/15' : ''}\`}>
                    {Number(s.callIV || 0).toFixed(1)}%
                  </td>
                  <td className={\`py-1.5 px-2 text-right font-bold text-emerald-400 border-r border-slate-800 \${isITMCall ? 'bg-emerald-950/15' : ''}\`}>`;

code = code.replace(oldRowStart, newRowStart);

const oldRowEnd = `<td className={\`py-1.5 px-2 text-left text-slate-500 \${isITMPut ? 'bg-rose-950/10' : ''}\`}>
                    {s.putIV}%
                  </td>
                  <td className={\`py-1.5 px-2 text-left text-slate-500 \${isITMPut ? 'bg-rose-950/10' : ''}\`}>
                    {s.putOI}
                  </td>`;

const newRowEnd = `<td className={\`py-1.5 px-2 text-left text-slate-500 \${isITMPut ? 'bg-rose-950/10' : ''}\`}>
                    {Number(s.putIV || 0).toFixed(1)}%
                  </td>
                  <td className={\`py-1.5 px-2 text-left text-slate-500 \${isITMPut ? 'bg-rose-950/10' : ''}\`}>
                    {(s.putOI / 1000).toFixed(1)}
                  </td>
                  <td className={\`py-1.5 px-2 text-left text-slate-500 \${isITMPut ? 'bg-rose-950/10' : ''}\`}>
                    {(s.putVolume / 1000).toFixed(1)}
                  </td>`;

code = code.replace(oldRowEnd, newRowEnd);

fs.writeFileSync('src/components/OptionChainView.tsx', code);
console.log('Patched OptionChainView');
