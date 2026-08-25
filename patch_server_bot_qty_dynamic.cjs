const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const helperCode = `const getInstrumentKey = (symbol: string)  => {`;

const newHelper = `
const lotSizeCache: Record<string, number> = {};

const getDynamicLotSize = async (symbol: string, token: string): Promise<number> => {
  if (lotSizeCache[symbol]) return lotSizeCache[symbol];
  let defaultLot = 1;
  if (symbol.includes('FIN SERVICE') || symbol.includes('FINNIFTY')) defaultLot = 65;
  else if (symbol.includes('BANK')) defaultLot = 15;
  else if (symbol.includes('NIFTY')) defaultLot = 25;
  else if (symbol.includes('SENSEX')) defaultLot = 10;
  
  if (!token) return defaultLot;
  
  const instrumentKey = getInstrumentKey(symbol);
  try {
     const contractRes = await fetch(\`https://api.upstox.com/v2/option/contract?instrument_key=\${encodeURIComponent(instrumentKey)}\`, {
         headers: { 'Authorization': \`Bearer \${token}\`, 'Accept': 'application/json' }
     });
     if (contractRes.ok) {
         const contractData = await contractRes.json();
         if (contractData.data && contractData.data.length > 0) {
             if (contractData.data[0].lot_size) {
                 const upstoxLotSize = contractData.data[0].lot_size;
                 lotSizeCache[symbol] = upstoxLotSize;
                 return upstoxLotSize;
             }
         }
     }
  } catch (e) {
  }
  return defaultLot;
};

const getInstrumentKey = (symbol: string)  => {`;

code = code.replace(helperCode, newHelper);

const botQtyRegex = /const botQty = optionSymbol\.includes\('FIN SERVICE'\)[\s\S]*?;/;
code = code.replace(botQtyRegex, `const botQty = await getDynamicLotSize(optionSymbol, token);`);

fs.writeFileSync('server.ts', code);
console.log('Patched botQty dynamic');
