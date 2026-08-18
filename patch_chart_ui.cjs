const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

// Change Chart UI to look more modern
code = code.replace(/bg-\[#0b0f19\]/g, "bg-[#090b14]");
code = code.replace(/border-slate-800\/80/g, "border-[#1d2335]");
code = code.replace(/border-slate-800/g, "border-[#1d2335]");
code = code.replace(/text-slate-200/g, "text-white");
code = code.replace(/text-slate-400/g, "text-slate-400");

fs.writeFileSync('src/components/CandlestickChart.tsx', code);
