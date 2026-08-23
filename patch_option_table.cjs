const fs = require('fs');
let code = fs.readFileSync('src/components/OptionChainView.tsx', 'utf8');

code = code.replace('<div className="flex-1 overflow-auto">', '<div className="flex-1 w-full overflow-x-auto overflow-y-auto webkit-scrollbar">');
code = code.replace('<table className="w-full text-left border-collapse text-[11px] font-mono">', '<table className="w-full text-left border-collapse text-[11px] font-mono min-w-[600px]">');

fs.writeFileSync('src/components/OptionChainView.tsx', code);
console.log('Option Chain View table layout patched');
