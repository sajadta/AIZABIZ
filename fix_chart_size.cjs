const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

const oldParent = '<div ref={chartContainerRef} className="flex-1 w-full relative" />';
const newParent = '<div className="flex-1 w-full relative min-h-[300px]"><div ref={chartContainerRef} className="absolute inset-0" /></div>';

code = code.replace(oldParent, newParent);
fs.writeFileSync('src/components/CandlestickChart.tsx', code);
console.log('Fixed chart container height');
