const fs = require('fs');
let code = fs.readFileSync('src/components/OrderModal.tsx', 'utf8');

const getLotSize = `const getLotSize = (sym: string) => {
    if (sym.includes('FIN SERVICE') || sym.includes('FINNIFTY')) return 65;
    if (sym.includes('BANK')) return 15;
    if (sym.includes('NIFTY')) return 25;
    if (sym.includes('SENSEX')) return 10;
    return 1;
  };
  
  const [quantity, setQuantity] = useState<number>(getLotSize(symbol));`

code = code.replace(`const [quantity, setQuantity] = useState<number>(symbol.includes('BANK') ? 15 : symbol.includes('NIFTY') ? 25 : 10);`, getLotSize);
code = code.replace(`const lotStep = symbol.includes('BANK') ? 15 : symbol.includes('NIFTY') ? 25 : 1;`, `const lotStep = getLotSize(symbol);`);

fs.writeFileSync('src/components/OrderModal.tsx', code);
console.log('Patched OrderModal.tsx');
