function getNextExpiry(symbol) {
  const d = new Date();
  const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  let targetDay = 4; // Default to Thursday (Nifty)
  
  if (symbol.includes('BANK')) targetDay = 3; // Wednesday
  else if (symbol.includes('FIN')) targetDay = 2; // Tuesday
  else if (symbol.includes('MIDCP')) targetDay = 1; // Monday
  
  let diff = targetDay - dayOfWeek;
  if (diff < 0) diff += 7; // if today is Friday (5) and target is Thursday (4) -> diff = -1 + 7 = 6
  if (diff === 0 && d.getHours() >= 15 && d.getMinutes() >= 30) {
     // If it's expiry day but after market hours, maybe next expiry? Actually let's just keep today. Upstox might still return today's chain until midnight.
  }
  
  const expiryDate = new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
  return expiryDate.toISOString().split('T')[0];
}

console.log('NIFTY 50:', getNextExpiry('NIFTY 50'));
console.log('BANK NIFTY:', getNextExpiry('BANK NIFTY'));
console.log('FIN NIFTY:', getNextExpiry('FIN NIFTY'));
