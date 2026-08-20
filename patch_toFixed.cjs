const fs = require('fs');

function patchFile(file) {
    if (!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');

    // Watchlist.tsx
    if (file.includes('Watchlist.tsx')) {
        code = code.replace(/\{q\.change\.toFixed\(2\)\}/g, '{Number(q.change || 0).toFixed(2)}');
        code = code.replace(/\{q\.low\.toFixed\(1\)\}/g, '{Number(q.low || 0).toFixed(1)}');
        code = code.replace(/\{q\.high\.toFixed\(1\)\}/g, '{Number(q.high || 0).toFixed(1)}');
        code = code.replace(/\{\(q\.volume \/ 100000\)\.toFixed\(2\)\}/g, '{Number((q.volume || 0) / 100000).toFixed(2)}');
    }

    // CandlestickChart.tsx
    if (file.includes('CandlestickChart.tsx')) {
        code = code.replace(/\{quote\.change\.toFixed\(2\)\}/g, '{Number(quote.change || 0).toFixed(2)}');
        code = code.replace(/\{\(hoveredCandle\.volume \/ 1000\)\.toFixed\(1\)\}/g, '{Number((hoveredCandle.volume || 0) / 1000).toFixed(1)}');
    }
    
    // OrderModal.tsx
    if (file.includes('OrderModal.tsx')) {
        code = code.replace(/defaultPrice \*/g, '(defaultPrice || 0) *');
        code = code.replace(/\{defaultPrice\.toFixed/g, '{Number(defaultPrice || 0).toFixed');
    }
    
    // OptionChainView.tsx
    if (file.includes('OptionChainView.tsx')) {
        code = code.replace(/data\.underlyingLTP\.toFixed/g, 'Number(data.underlyingLTP || 0).toFixed');
        code = code.replace(/s\.callOI \/ 1000\)\.toFixed/g, '(s.callOI || 0) / 1000).toFixed');
        code = code.replace(/s\.callLTP\.toFixed/g, 'Number(s.callLTP || 0).toFixed');
        code = code.replace(/s\.putLTP\.toFixed/g, 'Number(s.putLTP || 0).toFixed');
        code = code.replace(/s\.putOI \/ 1000\)\.toFixed/g, '(s.putOI || 0) / 1000).toFixed');
    }
    
    fs.writeFileSync(file, code);
}

patchFile('src/components/Watchlist.tsx');
patchFile('src/components/CandlestickChart.tsx');
patchFile('src/components/OrderModal.tsx');
patchFile('src/components/OptionChainView.tsx');
