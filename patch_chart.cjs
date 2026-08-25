const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

const oldButtons = `<div className="flex items-center gap-2 border-l border-slate-800 pl-4">
            <button 
              onClick={() => onOpenOrderModal('BUY', symbol, currentLtp)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-900/20"
            >
              BUY
            </button>
            <button 
              onClick={() => onOpenOrderModal('SELL', symbol, currentLtp)}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-rose-900/20"
            >
              SELL
            </button>
          </div>`;

const newButtons = `{!symbol.includes('NIFTY') && !symbol.includes('SENSEX') && quote?.segment !== 'INDEX' && (
          <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
            <button 
              onClick={() => onOpenOrderModal('BUY', symbol, currentLtp)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-900/20"
            >
              {language === 'ml' ? 'വാങ്ങുക (BUY)' : 'BUY'}
            </button>
            <button 
              onClick={() => onOpenOrderModal('SELL', symbol, currentLtp)}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-rose-900/20"
            >
              {language === 'ml' ? 'വിൽക്കുക (SELL)' : 'SELL'}
            </button>
          </div>
          )}`;

code = code.replace(oldButtons, newButtons);
fs.writeFileSync('src/components/CandlestickChart.tsx', code);
console.log('Patched CandlestickChart.tsx');
