// Shared fixtures for the server rule tests.

export function calculateOptionStopLoss(
  buyPrice: number,
  quantity: number,
  stopLossPercent: number,
) {
  const effectiveSlPct = Math.max(10.0, Math.min(18.0, Number(stopLossPercent || 14.0)));
  let optionSlPoints = Math.max(6.0, Number((buyPrice * (effectiveSlPct / 100)).toFixed(2)));
  if (buyPrice < 24) {
    optionSlPoints = Math.min(optionSlPoints, Number((buyPrice * 0.25).toFixed(2)));
  }
  const dynamicMaxRupeeLossCap = Math.max(
    380,
    Math.min(650, Math.round(optionSlPoints * quantity)),
  );
  if (optionSlPoints * quantity > dynamicMaxRupeeLossCap) {
    optionSlPoints = Number((dynamicMaxRupeeLossCap / quantity).toFixed(2));
  }
  const stopLossPrice = Number(Math.max(0.1, buyPrice - optionSlPoints).toFixed(2));
  return {
    optionSlPoints,
    dynamicMaxRupeeLossCap,
    stopLossPrice,
    maxRupeeLoss: Math.round(optionSlPoints * quantity),
  };
}

export function canEnterTradeAfterExit(
  lastExitTimeMs: number,
  currentTimeMs: number,
  cooldownMs: number = 180000,
): boolean {
  return currentTimeMs - lastExitTimeMs >= cooldownMs;
}

export function makeMockJwt(expUnixSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: '5VCABX', exp: expUnixSeconds })).toString(
    'base64url',
  );
  return `${header}.${payload}.signature`;
}
