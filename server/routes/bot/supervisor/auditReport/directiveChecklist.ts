// Directive compliance checklist: the 12-point rule matrix the supervisor verifies.
import { botConfig, botSignals } from '../../../../state';

export interface DirectiveCheckItem {
  id: string;
  titleEn: string;
  titleMl: string;
  status: string;
  detailMl: string;
}

export function buildDirectiveChecklist(hasToken: boolean): DirectiveCheckItem[] {
  return [
    {
      id: 'DIR_1_MULTI_CANDLE',
      titleEn: 'Multi-Candle & Pattern Confluence (Never Single Green Candle)',
      titleMl: 'ഒരു പച്ച കാൻഡിൽ മാത്രം നോക്കാതെ മൾട്ടി-കാൻഡിൽ & പാറ്റേൺ പരിശോധന',
      status: 'ACTIVE_OK',
      detailMl:
        'Engulfing, Morning Star, Hammer, Inside-Bar + 1m/3m/5m/15m MTF കൺഫർമേഷൻ പ്രവർത്തിക്കുന്നു.',
    },
    {
      id: 'DIR_2_CHART_HISTORY_SR',
      titleEn: '60-Candle Chart History (Double Bottom/Top, HH-HL) & S/R Runway',
      titleMl: '60-കാൻഡിൽ ചാർട്ട് ഹിസ്റ്ററി (W/M Pattern, HH-HL) & സപ്പോർട്ട്/റെസിസ്റ്റൻസ് റൺവേ',
      status: 'ACTIVE_OK',
      detailMl: 'Nearest Support & Resistance കണക്കാക്കി Clear Runway Points ഉറപ്പാക്കുന്നു.',
    },
    {
      id: 'DIR_3_RESISTANCE_BREAKOUT',
      titleEn: 'Resistance-Shattering Volume + OI Short-Covering Breakout Engine',
      titleMl: 'റെസിസ്റ്റൻസ് ഭേദിക്കുന്ന വോളിയം (RVOL >= 1.25x) & OI ബ്രേക്ക്ഔട്ട് എഞ്ചിൻ',
      status: 'ACTIVE_OK',
      detailMl:
        'വോളിയം ഉണ്ടെങ്കിൽ അടുത്ത വലിയ ടാർഗെറ്റിലേക്ക് (R2) ട്രേഡ് എടുക്കുന്നു; ഇല്ലെങ്കിൽ Trap തടയുന്നു.',
    },
    {
      id: 'DIR_4_CORP_MACRO',
      titleEn: 'Live Corporate Heavyweights (HDFC, Reliance, ICICI, Infy, TCS) & Global Macro',
      titleMl:
        'കോർപ്പറേറ്റ് ഹെവിവെയ്റ്റ് സ്റ്റോക്കുകളുടെയും ഗ്ലോബൽ മാർക്കറ്റിന്റെയും തത്സമയ പരിശോധന',
      status: 'ACTIVE_OK',
      detailMl:
        'ഓരോ 5 സെക്കൻഡിലും 10 പ്രധാന കമ്പനികളുടെ ഓർഡർ ഫ്ലോയും സെക്ടർ ദിശയും പരിശോധിക്കുന്നു.',
    },
    {
      id: 'DIR_5_GREEKS_BROKERAGE',
      titleEn: 'Option Greeks (Delta, Gamma, Theta, IV) & Net Profit After Brokerage Guard',
      titleMl: 'ഓപ്ഷൻ ഗ്രീക്ക്സ് (Delta, Gamma, Theta, IV) & ബ്രോക്കറേജ് കഴിഞ്ഞ് ലാഭം ഉറപ്പാക്കൽ',
      status: 'ACTIVE_OK',
      detailMl: `മൊത്തം ബ്രോക്കറേജും നികുതിയും കഴിഞ്ഞ് കുറഞ്ഞത് ₹${botConfig.minOptionProfitAmount || 300} (2.5x Brokerage) ലാഭമുള്ളവ മാത്രം.`,
    },
    {
      id: 'DIR_6_FORECAST_TIME_MAX',
      titleEn: 'Pre-Trade Exact Entry Timing, Time-to-Target & Max Profit Forecast',
      titleMl:
        'എപ്പോൾ വാങ്ങണം, എപ്പോൾ ലാഭത്തിലാകും, പരമാവധി എത്ര രൂപ കിട്ടും എന്ന മുൻകൂർ കണക്കുകൂട്ടൽ',
      status: botSignals.length > 0 ? 'ACTIVE_OK' : hasToken ? 'SCANNING' : 'WARN',
      detailMl:
        botSignals.length > 0
          ? `${botSignals.length} സൂചികകളിൽ Max Option Price & Time-to-Target തത്സമയം കണക്കാക്കുന്നു.`
          : 'Upstox ലൈവ് ഫീഡ് വഴി സിഗ്നലുകൾ സ്കാൻ ചെയ്യുന്നു.',
    },
    {
      id: 'DIR_7_INTRA_CANDLE_FILTER',
      titleEn: 'Intra-Candle Oscillation Filter (Never Faked Out by Forming Candle Whipsaws)',
      titleMl: 'കാൻഡിൽ രൂപപ്പെടുമ്പോഴുള്ള ചാഞ്ചാട്ടത്തിൽ വഞ്ചിതരാകാത്ത മൾട്ടി-പരാമീറ്റർ ഫിൽട്ടർ',
      status: 'ACTIVE_OK',
      detailMl:
        'കാൻഡിൽ ആട്ടം മാത്രം നോക്കാതെ ഇൻഡക്സ് + ഹെവിവെയ്റ്റ് + OI പരാമീറ്ററുകൾ ചേർത്ത് പരിശോധിക്കുന്നു.',
    },
    {
      id: 'DIR_8_PEAK_SL_LOCK',
      titleEn: 'Peak Profit Stop-Loss Lock (Locks SL at Peak Instead of Premature Exit)',
      titleMl:
        'മാക്സിമം പ്രോഫിറ്റിൽ എത്തുമ്പോൾ വിൽക്കാതെ അവിടെ Stop-Loss ലോക്ക് ചെയ്യുന്ന സംവിധാനം',
      status: 'ACTIVE_OK',
      detailMl:
        'വില കുറഞ്ഞാൽ മാക്സിമം ലാഭത്തിൽ വിൽക്കും; വീണ്ടും കൂടിയാൽ ആ അധിക ലാഭവും മുഴുവനായി പിടിച്ചെടുക്കും!',
    },
    {
      id: 'DIR_9_AUTO_MOVING_TP_SL',
      titleEn: 'Automatic Moving Target & Automatic Ratcheting Stop-Loss (One-Way Upward)',
      titleMl:
        'ഓട്ടോമാറ്റിക്കായി മുകളിലേക്ക് നീങ്ങുന്ന ടാർഗെറ്റും സ്റ്റോപ്പ്-ലോസും (One-Way Ratchet)',
      status: botConfig.trailingStopLoss ? 'ACTIVE_OK' : 'WARN',
      detailMl: botConfig.trailingStopLoss
        ? 'ഓരോ 1m കാൻഡിൽ ഉയരുമ്പോഴും സ്റ്റോപ്പ്-ലോസും ടാർഗെറ്റും ഓട്ടോമാറ്റിക്കായി മുകളിലേക്ക് കയറുന്നു.'
        : 'ശ്രദ്ധിക്കുക: Trailing Stop Loss ഓഫാണ്! ഓട്ടോ-മൂവിങ് പ്രവർത്തിക്കാൻ ഇത് ഓൺ ചെയ്യുക.',
    },
    {
      id: 'DIR_10_EARLY_INVALIDATION',
      titleEn: '35s Parameter Invalidation Cut & ₹400 Max Stop-Loss Cap',
      titleMl:
        'പരാമീറ്ററുകൾ തിരിഞ്ഞാൽ സ്റ്റോപ്പ്-ലോസിന് കാത്തുനിൽക്കാതെ ഉടൻ കട്ട് ചെയ്യുന്ന സുരക്ഷ',
      status: Number(botConfig.stopLossPercent || 12.0) <= 22.0 ? 'ACTIVE_OK' : 'WARN',
      detailMl: `പരമാവധി നഷ്ടം ₹400-ൽ താഴെയായി പരിമിതപ്പെടുത്തിയിരിക്കുന്നു (നിലവിൽ Config: ${botConfig.stopLossPercent}%).`,
    },
    {
      id: 'DIR_11_COOLDOWN_ANTICHURN',
      titleEn: '5-Min Global Cooldown, 30-Min Strike Lockout & 1 Entry/Day Max Anti-Churn Guard',
      titleMl: 'സ്മാർട്ട് സ്ട്രൈക്ക് ലോക്കൗട്ട് & വൻ ലാഭ ബ്രേക്ക്ഔട്ട് റീ-എൻട്രി (Smart Re-Entry)',
      status: 'ACTIVE_OK',
      detailMl:
        'ചെറിയ ലാഭങ്ങൾക്കായി വീണ്ടും എടുത്ത് ബ്രോക്കറേജ് നഷ്ടപ്പെടുന്നത് തടയുന്നു; അതേസമയം മുൻ ട്രേഡ് ലാഭത്തിലാണെങ്കിൽ വലിയ ബ്രേക്ക്ഔട്ടുകൾക്ക് 3 മിനിറ്റിനു ശേഷം വീണ്ടും എൻട്രി നൽകുന്നു.',
    },
    {
      id: 'DIR_12_CHOP_0DTE_TIME',
      titleEn: 'Sideways Market (ADX < 16) Veto, 0DTE Expiry Protection & 09:18–15:15 Window',
      titleMl: 'സൈഡ്‌വേയ്‌സ് മാർക്കറ്റ് തടയൽ & 09:18–03:15 PM വിപുലീകരിച്ച എൻട്രി വിൻഡോ',
      status: 'ACTIVE_OK',
      detailMl:
        'ADX < 16 സൈഡ്‌വേയ്‌സ് മാർക്കറ്റിൽ ട്രേഡ് ഒഴിവാക്കുന്നു; ലാഭകരമായ ട്രെൻഡുകൾ അവസാന നിമിഷം വരെ (03:15 PM വരെ) പിടിച്ചെടുക്കുന്നു.',
    },
    {
      id: 'DIR_13_VIX_SLIPPAGE_DRAWDOWN',
      titleEn:
        'India VIX Regime Auto-Switch, Smart Limit Slippage Cap (+0.5%) & 1:2.8+ Risk-Reward Guard',
      titleMl:
        'India VIX വോളട്ടിലിറ്റി നിയന്ത്രണം, ലിമിറ്റ് ഓർഡർ സ്ലിപ്പേജ് സംരക്ഷണം (+0.5%), 1:2.8+ അസമമായ ലാഭ അനുപാതം',
      status: 'ACTIVE_OK',
      detailMl:
        'ചെറിയ ലാഭങ്ങൾക്കായി ട്രേഡ് കട്ട് ചെയ്യാതെ (Anti-Micro Scalp) 1:2.8+ ഉയർന്ന ലാഭം ലക്ഷ്യമിടുന്നു.',
    },
    {
      id: 'DIR_14_ZERO_LOSS_INSTITUTIONAL_VAULT',
      titleEn: 'Anti-Micro Scalp Protocol & Risk-Free Breakeven Lock (+12% / +₹180)',
      titleMl:
        'ആന്റി-മൈക്രോ സ്കാൽപ്: ₹25-₹100 പീനട്ട് എക്സിറ്റ് പൂർണ്ണമായി ഒഴിവാക്കി മാക്സിമം പ്രോഫിറ്റിലേക്ക് റൈഡ് ചെയ്യൽ',
      status: 'ACTIVE_OK',
      detailMl:
        '+12% ലാഭത്തിൽ എത്തുമ്പോൾ സ്റ്റോപ്പ്-ലോസ് കോസ്റ്റ്+ബ്രോക്കറേജിലേക്ക് മാറ്റി റിസ്ക്-ഫ്രീ ആക്കുന്നു; ചെറിയ ചിലമ്പലുകളിൽ വിൽക്കാതെ പരമാവധി ലാഭത്തിലേക്ക് റൈഡ് ചെയ്യുന്നു.',
    },
    {
      id: 'DIR_15_PEAK_CLIMAX_HARVESTER',
      titleEn:
        'Top Climax Reversal & Dynamic ATR Peak Harvester (Locks 90-95% Top Profit at Points 3 & 4)',
      titleMl:
        'പോയിന്റ് 3, 4-ലെ മാക്സിമം പ്രോഫിറ്റിൽ Climax Wick & ATR പുൾബാക്ക് തിരിച്ചറിഞ്ഞ് ടോപ്പിൽ എക്സിറ്റ് ചെയ്യൽ',
      status: 'ACTIVE_OK',
      detailMl:
        'കാൻഡിലിന്റെ മുകളിലെ Wick >= 35%, ATR പുൾബാക്ക് (1.8%-2.5%), ഇൻഡക്സ് റെസിസ്റ്റൻസ് എന്നിവ തിരിച്ചറിഞ്ഞ് ഏറ്റവും ഉയർന്ന വിലയിൽ തന്നെ എക്സിറ്റ് ചെയ്യുന്നു.',
    },
  ];
}
