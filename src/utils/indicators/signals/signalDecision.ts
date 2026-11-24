// Direction decision for a fresh signal: BUY/SELL/HOLD, stop-loss, targets and rationale.
export interface SignalDecisionParams {
  symbol: string;
  currentLtp: number;
  supertrendVal: number;
  vwapVal: number;
  rvol: number;
  adxVal: number;
  corpScore: number;
  bullishPoints: number;
  bearishPoints: number;
  tf15m: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  isSidewaysChopRegime: boolean;
  isCorporateMtfBullBlocked: boolean;
  isCorporateMtfBearBlocked: boolean;
  isStrongTechUptrend: boolean;
  isStrongTechDowntrend: boolean;
}

export interface SignalDecisionResult {
  signalType: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  rationale: string;
  rationaleMalayalam: string;
  totalBullishConfidence: number;
  totalBearishConfidence: number;
  indexPrefix: string;
  strikeStep: number;
}

export function decideSignalDirection(p: SignalDecisionParams): SignalDecisionResult {
  const {
    symbol,
    currentLtp,
    supertrendVal,
    vwapVal,
    rvol,
    adxVal,
    corpScore,
    bullishPoints,
    bearishPoints,
    tf15m,
    isSidewaysChopRegime,
    isCorporateMtfBullBlocked,
    isCorporateMtfBearBlocked,
    isStrongTechUptrend,
    isStrongTechDowntrend,
  } = p;

  const totalBullishConfidence = Math.min(99, Math.max(10, bullishPoints));
  const totalBearishConfidence = Math.min(99, Math.max(10, bearishPoints));

  let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let confidence = 50;
  let stopLoss = currentLtp * 0.99;
  let target1 = currentLtp * 1.012;
  let target2 = currentLtp * 1.025;
  let target3 = currentLtp * 1.04;
  let rationale = '';
  let rationaleMalayalam = '';

  const symUpper = symbol.toUpperCase();
  let indexPrefix = symUpper;
  let strikeStep = 50;
  if (symUpper.includes('BANKEX')) {
    indexPrefix = 'BANKEX';
    strikeStep = 100;
  } else if (symUpper.includes('SENSEX')) {
    indexPrefix = 'SENSEX';
    strikeStep = 100;
  } else if (symUpper.includes('MID SELECT') || symUpper.includes('MIDCP')) {
    indexPrefix = 'MIDCPNIFTY';
    strikeStep = 25;
  } else if (symUpper.includes('FIN')) {
    indexPrefix = 'FINNIFTY';
    strikeStep = 50;
  } else if (symUpper.includes('BANK')) {
    indexPrefix = 'BANKNIFTY';
    strikeStep = 100;
  } else if (symUpper.includes('NIFTY')) {
    indexPrefix = 'NIFTY';
    strikeStep = 50;
  }

  const bullDominanceSpread = totalBullishConfidence - totalBearishConfidence;
  const bearDominanceSpread = totalBearishConfidence - totalBullishConfidence;

  if (
    totalBullishConfidence >= 68 &&
    bullDominanceSpread >= 16 &&
    tf15m !== 'BEARISH' &&
    !isSidewaysChopRegime
  ) {
    signalType = 'BUY';
    confidence = totalBullishConfidence;
    stopLoss = Number(Math.min(supertrendVal, currentLtp * 0.985).toFixed(2));
    const risk = currentLtp - stopLoss;
    target1 = Number((currentLtp + risk * 1.5).toFixed(2));
    target2 = Number((currentLtp + risk * 2.5).toFixed(2));
    target3 = Number((currentLtp + risk * 4.0).toFixed(2));
    rationale = `[Corporate Quant Engine] 15m Trend Bullish, 5m Structure Confirmed, Spot (₹${currentLtp}) Above VWAP (₹${vwapVal}), RVOL ${rvol}x. High-Conviction CALL setup!`;
    rationaleMalayalam = `[കോർപ്പറേറ്റ് ക്വാണ്ട് അനാലിസിസ്] 15m ട്രെൻഡ് ബുള്ളിഷ്, 5m സ്ട്രക്ചർ ഉറപ്പിച്ചു, സ്പോട്ട് (₹${currentLtp}) VWAP-ക്ക് മുകളിൽ, RVOL ${rvol}x. ഉയർന്ന വിജയസാധ്യതയുള്ള CALL ട്രേഡ് ഉറപ്പിച്ചു.`;
  } else if (
    totalBearishConfidence >= 68 &&
    bearDominanceSpread >= 16 &&
    tf15m !== 'BULLISH' &&
    !isSidewaysChopRegime
  ) {
    signalType = 'SELL';
    confidence = totalBearishConfidence;
    stopLoss = Number(Math.max(supertrendVal, currentLtp * 1.015).toFixed(2));
    const risk = stopLoss - currentLtp;
    target1 = Number((currentLtp - risk * 1.5).toFixed(2));
    target2 = Number((currentLtp - risk * 2.5).toFixed(2));
    target3 = Number((currentLtp - risk * 4.0).toFixed(2));
    rationale = `[Corporate Quant Engine] 15m Trend Bearish, 5m Breakdown Confirmed, Spot (₹${currentLtp}) Below VWAP (₹${vwapVal}), RVOL ${rvol}x. High-Conviction PUT setup!`;
    rationaleMalayalam = `[കോർപ്പറേറ്റ് ക്വാണ്ട് അനാലിസിസ്] 15m ട്രെൻഡ് ബെയറിഷ്, 5m ബ്രേക്ക്ഡൗൺ ഉറപ്പിച്ചു, സ്പോട്ട് (₹${currentLtp}) VWAP-ക്ക് താഴെ, RVOL ${rvol}x. ഉയർന്ന വിജയസാധ്യതയുള്ള PUT ട്രേഡ് ഉറപ്പിച്ചു.`;
  } else {
    signalType = 'HOLD';
    confidence = 50;
    const holdReasonEn = isSidewaysChopRegime
      ? `Sideways Consolidation (ADX ${adxVal}, RVOL ${rvol}x). Corporate Quant Engine preserving capital in HOLD mode until clear breakout occurs.`
      : isCorporateMtfBullBlocked && tf15m === 'BULLISH' && corpScore <= -25
        ? `Heavyweights Bearish (${corpScore}). Waiting for corporate stock confirmation before CE entry.`
        : isCorporateMtfBearBlocked && tf15m === 'BEARISH' && corpScore >= 25
          ? `Heavyweights Bullish (+${corpScore}). Waiting for corporate stock confirmation before PE entry.`
          : isCorporateMtfBullBlocked
            ? `15m/5m Trend Bearish or below VWAP (₹${vwapVal}). Calls strictly vetoed to prevent buying in a downtrend.`
            : isCorporateMtfBearBlocked
              ? `15m/5m Trend Bullish or above VWAP (₹${vwapVal}). Puts strictly vetoed to prevent shorting an uptrend.`
              : `Market consolidating near key moving averages. Waiting for institutional A+ breakout confluence.`;
    const holdReasonMl = isSidewaysChopRegime
      ? `വിപണി റേഞ്ച്-ബൗണ്ട് അവസ്ഥയിൽ (ADX ${adxVal}). കൃത്യമായ ഇൻസ്റ്റിറ്റ്യൂഷണൽ ബ്രേക്ക്ഔട്ട് ഉണ്ടാകുന്നതുവരെ പണം നഷ്ടപ്പെടാതെ HOLD ചെയ്യുന്നു.`
      : isCorporateMtfBullBlocked && tf15m === 'BULLISH' && corpScore <= -25
        ? `പ്രമുഖ ഹെവിവെയിറ്റ് ഓഹരികൾ സമ്മർദ്ദത്തിലായതിനാൽ (${corpScore}) CE എൻട്രിക്ക് കൂടുതൽ സ്ഥിരീകരണം കാത്തിരിക്കുന്നു.`
        : isCorporateMtfBearBlocked && tf15m === 'BEARISH' && corpScore >= 25
          ? `പ്രമുഖ ഹെവിവെയിറ്റ് ഓഹരികൾ ബുള്ളിഷായതിനാൽ (+${corpScore}) PE എൻട്രിക്ക് കൂടുതൽ സ്ഥിരീകരണം കാത്തിരിക്കുന്നു.`
          : isCorporateMtfBullBlocked
            ? `15m/5m ഹയർ ടൈംഫ്രെയിം ഡൗൺട്രെൻഡിൽ ആയതിനാലും VWAP-ക്ക് താഴെയായതിനാലും കാൾ (CE) ഒഴിവാക്കി ക്യാപിറ്റൽ സുരക്ഷിതമാക്കി.`
            : isCorporateMtfBearBlocked
              ? `15m/5m ഹയർ ടൈംഫ്രെയിം അപ്‌ട്രെൻഡിൽ ആയതിനാലും VWAP-ക്ക് മുകളിലായതിനാലും പുട്ട് (PE) ഒഴിവാക്കി ക്യാപിറ്റൽ സുരക്ഷിതമാക്കി.`
              : `വിപണി സന്തുലിത അവസ്ഥയിൽ (HOLD). വ്യക്തമായ കോർപ്പറേറ്റ് ട്രെൻഡ് ബ്രേക്ക്ഔട്ടിനായി കാത്തിരിക്കുന്നു.`;
    rationale = holdReasonEn;
    rationaleMalayalam = holdReasonMl;
  }

  return {
    signalType,
    confidence,
    stopLoss,
    target1,
    target2,
    target3,
    rationale,
    rationaleMalayalam,
    totalBullishConfidence,
    totalBearishConfidence,
    indexPrefix,
    strikeStep,
  };
}
