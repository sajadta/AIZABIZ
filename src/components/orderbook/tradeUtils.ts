import type { Language } from '../../types';

export const formatTradeDateTime = (dateVal?: string | number, lang: Language = 'ml') => {
  if (!dateVal) return { dateStr: '—', timeStr: '—', fullStr: '—', rawDate: '' };
  try {
    let d: Date;
    if (typeof dateVal === 'number') {
      d = new Date(dateVal);
    } else {
      // If it is an ISO string or time string
      if (/^\d{1,2}:\d{2}/.test(dateVal) && !dateVal.includes('-') && !dateVal.includes('T')) {
        return { dateStr: '', timeStr: dateVal, fullStr: dateVal, rawDate: '' };
      }
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) {
      return { dateStr: '', timeStr: String(dateVal), fullStr: String(dateVal), rawDate: '' };
    }
    const monthsEn = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthsMl = [
      'ജനു',
      'ഫെബ്രു',
      'മാർച്ച്',
      'ഏപ്രിൽ',
      'മെയ്',
      'ജൂൺ',
      'ജൂലൈ',
      'ഓഗസ്റ്റ്',
      'സെപ്റ്റം',
      'ഒക്ടോ',
      'നവം',
      'ഡിസം',
    ];
    const month = lang === 'ml' ? monthsMl[d.getMonth()] : monthsEn[d.getMonth()];
    const dateStr = `${d.getDate()} ${month} ${d.getFullYear()}`;
    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const rawDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return {
      dateStr,
      timeStr,
      fullStr: `${dateStr}, ${timeStr}`,
      rawDate,
    };
  } catch {
    return { dateStr: '', timeStr: String(dateVal), fullStr: String(dateVal), rawDate: '' };
  }
};

// Helper to calculate duration between trade entry and exit
export const getTradeDuration = (
  openedVal?: string | number,
  closeVal?: string | number,
  lang: Language = 'ml',
) => {
  if (!openedVal || !closeVal) return null;
  try {
    const start = typeof openedVal === 'number' ? openedVal : new Date(openedVal).getTime();
    const end = typeof closeVal === 'number' ? closeVal : new Date(closeVal).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return null;
    const diffSecs = Math.floor((end - start) / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return lang === 'ml'
        ? `${diffDays} ദിവസം ${diffHours % 24} മണി`
        : `${diffDays}d ${diffHours % 24}h`;
    }
    if (diffHours > 0) {
      return lang === 'ml'
        ? `${diffHours} മണി ${diffMins % 60} മി`
        : `${diffHours}h ${diffMins % 60}m`;
    }
    if (diffMins > 0) {
      return lang === 'ml'
        ? `${diffMins} മിനിറ്റ് ${diffSecs % 60} സെക്കൻഡ്`
        : `${diffMins}m ${diffSecs % 60}s`;
    }
    return lang === 'ml' ? `${diffSecs} സെക്കൻഡ്` : `${diffSecs}s`;
  } catch {
    return null;
  }
};

// Helper to translate exit reason into clean, accurate user-friendly labels (never mislabels losses as Target Profit!)
export const translateExitReason = (
  reason?: string,
  lang: Language = 'ml',
  netPnL?: number,
  grossPnL?: number,
) => {
  const isMl = lang === 'ml';

  // 1. IF NET & GROSS ARE BOTH NEGATIVE:
  // It is mathematically impossible for this to be a Target Profit or Profit Booking!
  // It MUST be labeled as Stop-Loss, Reversal Guard, or Breakeven Protection.
  if (netPnL !== undefined && netPnL < 0 && (grossPnL === undefined || grossPnL <= 0)) {
    const r = (reason || '').toLowerCase();
    if (r.includes('reversal') || r.includes('invalidation') || r.includes('reversed')) {
      return isMl
        ? '🛡️ ട്രെൻഡ് റിവേഴ്സൽ പരിരക്ഷ (നഷ്ടം ഒഴിവാക്കി)'
        : '🛡️ Trend Reversal Guard (Cut Loss)';
    }
    if (
      r.includes('stagnation') ||
      r.includes('ejector') ||
      r.includes('paused') ||
      r.includes('zero-loss')
    ) {
      return isMl
        ? '⚖️ സ്റ്റാഗ്നേഷൻ കട്ട് (നഷ്ടം പരിമിതപ്പെടുത്തി)'
        : '⚖️ Stagnation Cut (Loss Minimized)';
    }
    if (r.includes('trailing') || r.includes('ratchet') || r.includes('auto-moving')) {
      return isMl ? '🛡️ ട്രെയിലിംഗ് സ്റ്റോപ്പ്-ലോസ് എക്സിറ്റ്' : '🛡️ Trailing Stop-Loss Exit';
    }
    return isMl
      ? '🛡️ സ്റ്റോപ്പ്-ലോസ് പരിരക്ഷ (നഷ്ടം പരിമിതപ്പെടുത്തി)'
      : '🛡️ Stop-Loss Risk Protection';
  }

  // 2. IF GROSS PnL IS ZERO OR SLIGHTLY POSITIVE, BUT NET PnL IS NEGATIVE (Because of Brokerage/Taxes):
  // Realized Gross is ~₹0, but Brokerage of ₹10-₹40 made Net Realized negative:
  if (netPnL !== undefined && netPnL < 0 && grossPnL !== undefined && grossPnL >= 0) {
    return isMl
      ? '⚖️ ബ്രേക്ക്-ഈവൻ എക്സിറ്റ് (ബ്രോക്കറേജ്/ടാക്സ് മാത്രം)'
      : '⚖️ Breakeven Exit (Taxes & Brokerage Only)';
  }

  // 3. IF NO REASON STRING PROVIDED:
  if (!reason) {
    if (netPnL !== undefined) {
      if (netPnL > 10) return isMl ? '🎯 ലാഭം ബുക്ക് ചെയ്തു' : '🎯 Profit Booked';
      if (netPnL < -10) return isMl ? '🛡️ സ്റ്റോപ്പ്-ലോസ് എക്സിറ്റ്' : '🛡️ Stop-Loss Exit';
      return isMl ? '⚖️ ബ്രേക്ക്-ഈവൻ എക്സിറ്റ്' : '⚖️ Breakeven Exit';
    }
    return isMl ? 'സിസ്റ്റം ഓട്ടോ എക്സിറ്റ്' : 'System Auto Exit';
  }

  const r = reason.toLowerCase();

  // 4. Genuine Target Profit (ONLY IF netPnL > 0 AND grossPnL > 0!)
  const isTargetWord =
    r.includes('target') ||
    r.includes('take-profit') ||
    r.includes('take profit') ||
    /\btp\b/i.test(reason);
  if (isTargetWord) {
    if (netPnL !== undefined && netPnL > 0) {
      return isMl ? '🎯 ടാർഗറ്റ് പ്രോഫിറ്റ് കൈവരിച്ചു' : '🎯 Target Profit Hit';
    }
    if (netPnL !== undefined && netPnL <= 0) {
      return isMl
        ? '⚖️ ബ്രേക്ക്-ഈവൻ എക്സിറ്റ് (ക്യാപിറ്റൽ സേഫ്)'
        : '⚖️ Breakeven Exit (Capital Preserved)';
    }
    return isMl ? '🎯 ടാർഗറ്റ് പ്രോഫിറ്റ് കൈവരിച്ചു' : '🎯 Target Profit Hit';
  }

  // 5. Breakeven / Stagnation Ejector Exits
  if (
    r.includes('zero-loss') ||
    r.includes('ejector') ||
    r.includes('stagnation') ||
    r.includes('breakeven') ||
    r.includes('breakout paused') ||
    r.includes('cost to preserve') ||
    r.includes('cost to eliminate')
  ) {
    if (netPnL !== undefined && netPnL < 0) {
      return isMl
        ? '⚖️ ബ്രേക്ക്-ഈവൻ എക്സിറ്റ് (ചിലവ് മാത്രം)'
        : '⚖️ Breakeven Exit (Brokerage Only)';
    }
    return isMl ? '⚖️ ബ്രേക്ക്-ഈവൻ പ്രൊട്ടക്ഷൻ' : '⚖️ Breakeven Protection';
  }

  // 6. Trend / Parameter Reversal Invalidation
  if (
    r.includes('invalidation') ||
    r.includes('parameter reversal') ||
    r.includes('parameters reversed') ||
    r.includes('trend reversal')
  ) {
    return isMl ? '🛡️ ട്രെൻഡ് റിവേഴ്സൽ പരിരക്ഷ' : '🛡️ Trend Reversal Guard';
  }

  // 7. Stop-Loss (Strict, Smart, or Max Loss Protection)
  if (
    r.includes('strict stop') ||
    r.includes('smart stop') ||
    r.includes('stop-loss hit') ||
    r.includes('sl hit') ||
    r.includes('stoploss') ||
    r.includes('below auto-sl') ||
    r.includes('prevent further loss') ||
    r.includes('minimize loss')
  ) {
    return isMl ? '🛡️ റിസ്ക് പ്രൊട്ടക്ഷൻ സ്റ്റോപ്പ്-ലോസ്' : '🛡️ Risk Protection Stop-Loss';
  }

  // 7b. Peak Harvester (Top Climax Reversal / ATR Pullback Top Capture)
  if (
    r.includes('volatility-adaptive') ||
    r.includes('peak harvester') ||
    r.includes('top harvest') ||
    r.includes('climax') ||
    r.includes('top exhaustion')
  ) {
    return isMl
      ? '🏆 പീക്ക് ഹാർവെസ്റ്റർ (മാക്സിമം ടോപ്പ് ലാഭം നേടി)'
      : '🏆 Peak Harvester (Top Profit Captured)';
  }

  // 8. Trailing Stop-Loss / Peak Ratchet Lock
  if (
    r.includes('trailing') ||
    r.includes('auto-moving') ||
    r.includes('ratchet') ||
    r.includes('peak-locked') ||
    r.includes('peak locked')
  ) {
    if (netPnL !== undefined && netPnL > 10) {
      return isMl
        ? '📈 ട്രെയിലിംഗ് സ്റ്റോപ്പ്-ലോസ് (ലാഭം ലോക്ക് ചെയ്തു)'
        : '📈 Trailing Stop-Loss (Locked Profit)';
    }
    if (netPnL !== undefined && netPnL < -10) {
      return isMl ? '🛡️ സ്റ്റോപ്പ്-ലോസ് എക്സിറ്റ്' : '🛡️ Stop-Loss Exit';
    }
    return isMl ? '⚖️ ബ്രേക്ക്-ഈവൻ പ്രൊട്ടക്ഷൻ' : '⚖️ Breakeven Protection';
  }

  // 9. Intraday Market Auto Square-Off
  if (
    r.includes('square') ||
    r.includes('market close') ||
    r.includes('15:15') ||
    r.includes('15:20')
  ) {
    return isMl ? '⏰ മാർക്കറ്റ് ക്ലോസിംഗ് സ്ക്വയർ-ഓഫ്' : '⏰ Market Auto Square-Off';
  }

  // 10. Manual Square-Off
  if (r.includes('manual')) {
    return isMl ? '👤 മാനുവൽ എക്സിറ്റ്' : '👤 Manual Square-Off';
  }

  // Fallback based on PnL
  if (netPnL !== undefined) {
    if (netPnL > 10) return isMl ? '🎯 ലാഭം ബുക്ക് ചെയ്തു' : '🎯 Profit Booked';
    if (netPnL < -10) return isMl ? '🛡️ സ്റ്റോപ്പ്-ലോസ് എക്സിറ്റ്' : '🛡️ Stop-Loss Exit';
    return isMl ? '⚖️ ബ്രേക്ക്-ഈവൻ എക്സിറ്റ്' : '⚖️ Breakeven Exit';
  }

  return reason.length > 50 ? (isMl ? 'സിസ്റ്റം ഓട്ടോ എക്സിറ്റ്' : 'System Auto Exit') : reason;
};
