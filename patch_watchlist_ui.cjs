const fs = require('fs');
let code = fs.readFileSync('src/components/Watchlist.tsx', 'utf8');

// Change Watchlist UI to look more modern
code = code.replace(/bg-\[#0b0f19\]/g, "bg-[#090b14]");
code = code.replace(/bg-slate-900\/60/g, "bg-[#111624]/60");
code = code.replace(/bg-slate-800/g, "bg-[#1d2335]");
code = code.replace(/border-slate-800\/80/g, "border-[#1d2335]");
code = code.replace(/border-slate-800/g, "border-[#1d2335]");

fs.writeFileSync('src/components/Watchlist.tsx', code);
