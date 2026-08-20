const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = /const q = quotes\.find\(x => x\.symbol === sym\) \|\| \{ ltp: 0, changePercent: 0 \};\s*const color = q\.changePercent >= 0 \? 'text-emerald-400' : 'text-rose-400';\s*const isUp = q\.changePercent >= 0;/g;

const replacement = `const q = quotes.find(x => x.symbol === sym) || { ltp: 0, changePercent: 0 };
                  const cp = q.changePercent || 0;
                  const ltp = q.ltp || 0;
                  const color = cp >= 0 ? 'text-emerald-400' : 'text-rose-400';
                  const isUp = cp >= 0;`;

code = code.replace(target, replacement);

const target2 = /\{q\.changePercent\.toFixed\(2\)\}%/g;
code = code.replace(target2, '{cp.toFixed(2)}%');

const target3 = /₹\{q\.ltp\.toLocaleString\('en-IN', \{ minimumFractionDigits: 2 \}\)\}/g;
code = code.replace(target3, '₹{ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}');

fs.writeFileSync('src/App.tsx', code);
