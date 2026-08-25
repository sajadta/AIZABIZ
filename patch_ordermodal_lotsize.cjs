const fs = require('fs');
let code = fs.readFileSync('src/components/OrderModal.tsx', 'utf8');

const importStatement = `import React, { useState, useEffect } from 'react';`;
code = code.replace(`import React, { useState } from 'react';`, importStatement);

const oldLotLogic = `  const getLotSize = (sym: string) => {
    if (sym.includes('FIN SERVICE') || sym.includes('FINNIFTY')) return 65;
    if (sym.includes('BANK')) return 15;
    if (sym.includes('NIFTY')) return 65;
    if (sym.includes('SENSEX')) return 10;
    return 1;
  };
  
  const [quantity, setQuantity] = useState<number>(getLotSize(symbol));`;

const newLotLogic = `  const [lotSize, setLotSize] = useState<number>(() => {
    if (symbol.includes('FIN SERVICE') || symbol.includes('FINNIFTY')) return 65;
    if (symbol.includes('BANK')) return 15;
    if (symbol.includes('NIFTY')) return 25;
    if (symbol.includes('SENSEX')) return 10;
    return 1;
  });
  const [quantity, setQuantity] = useState<number>(lotSize);

  useEffect(() => {
    const fetchInstrumentDetails = async () => {
      try {
        const res = await fetch(\`/api/instrument/details?symbol=\${encodeURIComponent(symbol)}\`);
        if (res.ok) {
           const data = await res.json();
           if (data.lotSize) {
              setLotSize(data.lotSize);
              // Only update quantity if it hasn't been changed by user yet or is same as old lotSize
              setQuantity(prev => (prev === 25 || prev === 65 || prev === 15 || prev === 10 || prev === 1) ? data.lotSize : prev);
           }
        }
      } catch (e) {
        // Fallback already set
      }
    };
    fetchInstrumentDetails();
  }, [symbol]);`;

code = code.replace(oldLotLogic, newLotLogic);
code = code.replace(`const lotStep = getLotSize(symbol);`, `const lotStep = lotSize;`);

fs.writeFileSync('src/components/OrderModal.tsx', code);
console.log('Patched OrderModal.tsx');
