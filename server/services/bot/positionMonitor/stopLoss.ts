// Option stop-loss sizing for open positions: keeps at least 6 points of breathing
// room while capping rupee risk by deployed-capital tier (nano / micro / standard).

export interface OptionStopLossPlan {
  qty: number;
  deployedValue: number;
  isNanoDeployedOpt: boolean;
  isMicroDeployedOpt: boolean;
  optionSlPoints: number;
  staticStopLossPrice: number;
  maxAllowedRupeeLoss: number;
}

export function computeOptionStopLossPlan(
  buyPrice: number,
  quantity: number,
  stopLossPercent: number,
): OptionStopLossPlan {
  const qty = Math.max(1, Number(quantity || 1));
  const deployedValue = buyPrice * qty;
  const isNanoDeployedOpt = deployedValue > 0 && deployedValue <= 300;
  const isMicroDeployedOpt = deployedValue > 0 && deployedValue <= 1500;
  const effectiveSlPct = Math.max(16.0, Math.min(24.0, Number(stopLossPercent || 18.0)));

  let optionSlPoints = Math.max(6.0, Number((buyPrice * (effectiveSlPct / 100)).toFixed(2)));
  if (buyPrice < 8 || isNanoDeployedOpt) {
    optionSlPoints = Math.min(buyPrice * 0.35, Math.max(0.5, Number((buyPrice * 0.28).toFixed(2))));
  } else if (buyPrice < 24 || isMicroDeployedOpt) {
    optionSlPoints = Math.min(optionSlPoints, Number((buyPrice * 0.24).toFixed(2)));
  }

  const dynamicMaxRupeeLossCap = isNanoDeployedOpt
    ? Math.max(40, Math.min(120, Math.round(Math.max(optionSlPoints * qty, deployedValue * 0.3))))
    : isMicroDeployedOpt
      ? Math.max(
          120,
          Math.min(320, Math.round(Math.max(optionSlPoints * qty, deployedValue * 0.24))),
        )
      : Math.max(380, Math.min(650, Math.round(optionSlPoints * qty)));

  if (optionSlPoints * qty > dynamicMaxRupeeLossCap) {
    optionSlPoints = Number((dynamicMaxRupeeLossCap / qty).toFixed(2));
  }

  return {
    qty,
    deployedValue,
    isNanoDeployedOpt,
    isMicroDeployedOpt,
    optionSlPoints,
    staticStopLossPrice: Number(Math.max(0.1, buyPrice - optionSlPoints).toFixed(2)),
    maxAllowedRupeeLoss: dynamicMaxRupeeLossCap,
  };
}
