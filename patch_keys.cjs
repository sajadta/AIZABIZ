const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `  const defaultKeys = [
    "NSE_INDEX|Nifty 50",
    "NSE_INDEX|Nifty Bank",
    "BSE_INDEX|SENSEX",
    "BSE_INDEX|BANKEX",
    "NSE_INDEX|Nifty Fin Service",
  ];`;
  
const replacement = `  const defaultKeys = [
    "NSE_INDEX|Nifty 50",
    "NSE_INDEX|Nifty Bank",
    "BSE_INDEX|SENSEX",
    "BSE_INDEX|BANKEX",
    "NSE_INDEX|Nifty Fin Service",
    "NSE_EQ|INE002A01018", // RELIANCE
    "NSE_EQ|INE040A01034", // HDFCBANK
    "NSE_EQ|INE467B01029", // TCS
    "NSE_EQ|INE009A01021", // INFY
    "NSE_EQ|INE090A01021", // ICICIBANK
    "NSE_EQ|INE062A01020", // SBI
    "NSE_EQ|INE238A01034", // AXISBANK
    "NSE_EQ|INE030A01027", // HINDUNILVR
    "NSE_EQ|INE154A01025", // ITC
    "NSE_EQ|INE018A01030", // LT
    "NSE_EQ|INE397D01024", // BHARTIARTL
    "NSE_EQ|INE296A01024", // BAJFINANCE
    "NSE_EQ|INE860A01027", // HCLTECH
    "NSE_EQ|INE021A01026", // ASIANPAINT
  ];`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
