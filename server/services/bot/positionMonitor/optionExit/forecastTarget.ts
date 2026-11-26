// Forecasts the realistic maximum option price used as an exit target.
import { calculateTradeCharges } from '../../../../../src/utils/indicators';

export interface ForecastTargetResult {
  forecastedMaxPrice: number;
  isShortPosition: boolean;
}

export function resolveForecastedMaxPrice(
  pos: any,
  targetProfitPercent?: number,
): ForecastTargetResult {
  const rawForecast = Number(
    pos.estimatedMaxOptionPrice ||
      pos.target2 ||
      pos.target ||
      pos.buyPrice * (1 + (targetProfitPercent || 30) / 100),
  );
  const estQty = Math.max(1, Number(pos.quantity || 1));
  const estRoundTripBrok = calculateTradeCharges(
    pos.buyPrice,
    estQty,
    true,
    pos.buyPrice * 1.6,
    pos.instrumentKey || pos.symbol,
  ).roundTripCharges;
  const minNetTargetRupees = pos.buyPrice * estQty <= 300 ? 55 : 110;
  const minProfitableForecast = Number(
    (pos.buyPrice + (estRoundTripBrok + minNetTargetRupees) / estQty).toFixed(2),
  );
  const isShortPosition = pos.type === 'SELL' || pos.optionStrategyType === 'OPTION_SELLING';
  const forecastedMaxPrice = isShortPosition
    ? rawForecast < pos.buyPrice
      ? rawForecast
      : Number((pos.buyPrice * 0.45).toFixed(2))
    : Math.max(
        minProfitableForecast,
        rawForecast > pos.buyPrice * 1.35
          ? rawForecast
          : Number((pos.buyPrice * (1 + Math.max(40, targetProfitPercent || 50) / 100)).toFixed(2)),
      );

  return { forecastedMaxPrice, isShortPosition };
}
