const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /\{\/\* Positions \*\/\}\s*<div className="flex-1 overflow-y-auto hide-scrollbar bg-slate-900\/80 border border-slate-800 rounded-2xl p-3">[\s\S]*?\{\/\* SUPPORT TAB \*\/\}/;
// Wait, Support tab comes after PORTFOLIO. Let's just find the exact block.
// We can use a simpler replace strategy.
