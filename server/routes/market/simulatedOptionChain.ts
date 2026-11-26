// Fallback option chain used when no Upstox token is configured (paper trading / demo).
import { getLastQuotesCache } from '../../state';

export function buildSimulatedOptionChain(symbol: string, requestedExpiry?: string) {
  let spot = 24200;
  let step = 50;
  let lotSize = 25;
  const symUpper = symbol.toUpperCase();
  if (symUpper.includes('BANKNIFTY') || symUpper.includes('NIFTY BANK')) {
    spot = 51500;
    step = 100;
    lotSize = 15;
  } else if (symUpper.includes('SENSEX')) {
    spot = 79500;
    step = 100;
    lotSize = 10;
  } else if (symUpper.includes('FINNIFTY') || symUpper.includes('FIN')) {
    spot = 23800;
    step = 50;
    lotSize = 25;
  } else if (symUpper.includes('MIDCPNIFTY') || symUpper.includes('MID')) {
    spot = 12800;
    step = 25;
    lotSize = 50;
  } else if (symUpper.includes('BANKEX')) {
    spot = 58000;
    step = 100;
    lotSize = 15;
  }
  const matchQ = getLastQuotesCache().quotes.find((q: any) =>
    q.symbol?.toUpperCase().includes(symbol.split(' ')[0].toUpperCase()),
  );
  if (matchQ && matchQ.ltp > 0) {
    spot = matchQ.ltp;
  }

  const atmStrike = Math.round(spot / step) * step;
  const strikes = [];
  let totalCallOI = 0;
  let totalPutOI = 0;

  for (let i = -15; i <= 15; i++) {
    const strikePrice = atmStrike + i * step;
    const dist = (strikePrice - spot) / step;
    const callLTP =
      strikePrice < spot
        ? Number((spot - strikePrice + 60 + Math.abs(dist) * 4).toFixed(1))
        : Number(Math.max(3.5, 120 - dist * 12).toFixed(1));
    const putLTP =
      strikePrice > spot
        ? Number((strikePrice - spot + 60 + Math.abs(dist) * 4).toFixed(1))
        : Number(Math.max(3.5, 120 + dist * 12).toFixed(1));
    const callOI = Math.max(
      12000,
      Math.round(1800000 - Math.abs(dist) * 90000 + Math.sin(i) * 50000),
    );
    const putOI = Math.max(
      12000,
      Math.round(1950000 - Math.abs(dist) * 95000 + Math.cos(i) * 60000),
    );
    totalCallOI += callOI;
    totalPutOI += putOI;

    strikes.push({
      strikePrice,
      callLTP,
      putLTP,
      callOI,
      putOI,
      callChangeOI: Math.round(callOI * 0.05),
      putChangeOI: Math.round(putOI * 0.06),
      callVolume: Math.round(callOI * 1.8),
      putVolume: Math.round(putOI * 1.6),
      callDelta: strikePrice < spot ? 0.65 : 0.42,
      putDelta: strikePrice > spot ? -0.65 : -0.42,
      callTheta: -4.5,
      putTheta: -4.2,
      callGamma: 0.002,
      putGamma: 0.002,
      callIV: Number((13.5 + Math.abs(dist) * 0.2).toFixed(1)),
      putIV: Number((14.1 + Math.abs(dist) * 0.2).toFixed(1)),
      callInstrumentKey: `NSE_FO|${symbol.replace(' 50', '')}${strikePrice}CE`,
      putInstrumentKey: `NSE_FO|${symbol.replace(' 50', '')}${strikePrice}PE`,
      lotSize,
    });
  }

  const nextThu = new Date();
  nextThu.setDate(nextThu.getDate() + ((4 - nextThu.getDay() + 7) % 7 || 7));
  const expStr = nextThu.toISOString().split('T')[0];

  return {
    underlyingSymbol: symbol,
    underlyingLTP: spot,
    lotSize,
    timestamp: new Date().toISOString(),
    expiryDates: [expStr],
    selectedExpiry: requestedExpiry || expStr,
    strikes,
    pcr: Number((totalPutOI / (totalCallOI || 1)).toFixed(2)),
    maxPain: atmStrike,
    totalCallOI,
    totalPutOI,
    isSimulated: true,
  };
}
