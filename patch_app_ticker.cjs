const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldTicker = "<TickerBar quotes={quotes} />";
const newTicker = `<TickerBar 
          quotes={quotes} 
          selectedSymbol={selectedSymbol}
          onSelectSymbol={(sym, key) => {
             setSelectedSymbol(sym);
             if(key) setSelectedInstrumentKey(key);
          }}
        />`;

code = code.replace(oldTicker, newTicker);

fs.writeFileSync('src/App.tsx', code);
console.log('Patched App.tsx for TickerBar');
