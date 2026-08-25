const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldKeyLogic = `const getInstrumentKey = (symbol: string)  => {
  const s = symbol.toUpperCase();
  if (s.includes('NIFTY 50'))  return 'NSE_INDEX|Nifty 50';
  if (s.includes('NIFTY BANK')  || s === 'BANKNIFTY')  return 'NSE_INDEX|Nifty Bank';
  if (s.includes('FIN SERVICE')  || s === 'FINNIFTY')  return 'NSE_INDEX|Nifty Fin Service';
  if (s.includes('MID SELECT'))  return 'NSE_INDEX|NIFTY MID SELECT';
  if (s.includes('SENSEX'))  return 'BSE_INDEX|SENSEX';
  if (s.includes('BANKEX'))  return 'BSE_INDEX|BANKEX';
  if (s.includes('RELIANCE'))  return 'NSE_EQ|INE002A01018';
  if (s.includes('HDFCBANK')  || s === 'HDFC')  return 'NSE_EQ|INE040A01034';
  if (s.includes('TCS'))  return 'NSE_EQ|INE467B01029';
  if (s.includes('INFY'))  return 'NSE_EQ|INE009A01021';
  return symbol;
};`;

const newKeyLogic = `const getInstrumentKey = (symbol: string)  => {
  const s = symbol.toUpperCase();
  if (s.includes('BANK') || s === 'BANKNIFTY') return 'NSE_INDEX|Nifty Bank';
  if (s.includes('FIN SERVICE') || s.includes('FINNIFTY')) return 'NSE_INDEX|Nifty Fin Service';
  if (s.includes('MID SELECT')) return 'NSE_INDEX|NIFTY MID SELECT';
  if (s.includes('NIFTY 50') || (s.includes('NIFTY') && !s.includes('BANK') && !s.includes('FIN'))) return 'NSE_INDEX|Nifty 50';
  if (s.includes('SENSEX')) return 'BSE_INDEX|SENSEX';
  if (s.includes('BANKEX')) return 'BSE_INDEX|BANKEX';
  if (s.includes('RELIANCE')) return 'NSE_EQ|INE002A01018';
  if (s.includes('HDFCBANK') || s === 'HDFC') return 'NSE_EQ|INE040A01034';
  if (s.includes('TCS')) return 'NSE_EQ|INE467B01029';
  if (s.includes('INFY')) return 'NSE_EQ|INE009A01021';
  return symbol;
};`;

code = code.replace(oldKeyLogic, newKeyLogic);
fs.writeFileSync('server.ts', code);
console.log('Patched getInstrumentKey');
