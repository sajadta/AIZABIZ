// Put-Call Ratio plus the highest Call-OI resistance wall and Put-OI support wall
// for the live option chain of one index.

export interface ChainOiMetrics {
  chainPcr: number;
  callWallStrike: number;
  maxCallWallOi: number;
  putWallStrike: number;
  maxPutWallOi: number;
}

export const computeChainOiMetrics = (rows: any[], liveLtp: number): ChainOiMetrics => {
  let totalCallOi = 0;
  let totalPutOi = 0;
  let callWallStrike = 0;
  let maxCallWallOi = 0;
  let putWallStrike = 0;
  let maxPutWallOi = 0;

  for (const row of rows) {
    const sp = Number(row.strike_price || 0);
    const cOi = Number(row.call_options?.market_data?.oi || 0);
    const pOi = Number(row.put_options?.market_data?.oi || 0);
    totalCallOi += cOi;
    totalPutOi += pOi;
    if (sp > liveLtp && cOi > maxCallWallOi) {
      maxCallWallOi = cOi;
      callWallStrike = sp;
    }
    if (sp < liveLtp && pOi > maxPutWallOi) {
      maxPutWallOi = pOi;
      putWallStrike = sp;
    }
  }

  return {
    chainPcr: totalCallOi > 0 ? Number((totalPutOi / totalCallOi).toFixed(2)) : 1.0,
    callWallStrike,
    maxCallWallOi,
    putWallStrike,
    maxPutWallOi,
  };
};
