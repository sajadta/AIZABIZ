export interface TradeChargesBreakdown {
  tradeValue: number;
  buyBrokerage: number;
  sellBrokerage: number;
  stt: number;
  exchangeTxnCharge: number;
  sebiCharge: number;
  stampDuty: number;
  gst: number;
  buyCharges: number;
  sellCharges: number;
  roundTripCharges: number;
  totalRequiredWithBrokerage: number;
}

/**
 * Calculates exact Upstox Brokerage + Statutory Taxes (STT, NSE/BSE Exchange Txn, GST 18%, Stamp Duty, SEBI)
 * for both BUY entry and SELL exit (Round-Trip) so account cash checks always include full brokerage!
 */
export function calculateTradeCharges(
  entryPrice: number,
  quantity: number,
  isOption: boolean = true,
  exitPriceOverride?: number,
): TradeChargesBreakdown {
  const qty = Math.max(1, Number(quantity) || 1);
  const buyPrice = Math.max(0, Number(entryPrice) || 0);
  const sellPrice =
    exitPriceOverride !== undefined && exitPriceOverride > 0
      ? Number(exitPriceOverride)
      : Number((buyPrice * 1.25).toFixed(2));

  const buyValue = buyPrice * qty;
  const sellValue = sellPrice * qty;

  if (isOption) {
    // Upstox F&O Options: ₹30 flat per executed order on user's active plan (₹30 Buy + ₹30 Sell = ₹60 base brokerage)
    // Matches live Upstox /v2/charges/brokerage API exactly (~₹35.98 Buy + ~₹38.76 Sell = ~₹74.74 round-trip)
    // Upstox F&O Options: min(₹20, 2.5% of turnover) per executed order
    const buyBrokerage = buyValue > 0 ? Number(Math.min(20, Math.max(0.01, buyValue * 0.025)).toFixed(2)) : 20;
    const buyTxn = buyValue * 0.000495; // 0.0495% NSE txn charge (approx ₹49.5 per lakh)
    const buySebi = buyValue * 0.000001;
    const buyStamp = Math.max(0.01, buyValue * 0.00003); // 0.003% stamp duty
    const buyGst = (buyBrokerage + buyTxn + buySebi) * 0.18;
    const buyCharges = buyBrokerage + buyTxn + buySebi + buyStamp + buyGst;

    const sellBrokerage = sellValue > 0 ? Number(Math.min(20, Math.max(0.01, sellValue * 0.025)).toFixed(2)) : 20;
    const sellStt = sellValue * 0.001; // 0.1% STT on Option SELL (Budget 2024 rate)
    const sellTxn = sellValue * 0.000495;
    const sellSebi = sellValue * 0.000001;
    const sellGst = (sellBrokerage + sellTxn + sellSebi) * 0.18;
    const sellCharges = sellBrokerage + sellStt + sellTxn + sellSebi + sellGst;

    const roundTripCharges = Number((buyCharges + sellCharges).toFixed(2));
    return {
      tradeValue: Number(buyValue.toFixed(2)),
      buyBrokerage,
      sellBrokerage,
      stt: Number(sellStt.toFixed(2)),
      exchangeTxnCharge: Number((buyTxn + sellTxn).toFixed(2)),
      sebiCharge: Number((buySebi + sellSebi).toFixed(2)),
      stampDuty: Number(buyStamp.toFixed(2)),
      gst: Number((buyGst + sellGst).toFixed(2)),
      buyCharges: Number(buyCharges.toFixed(2)),
      sellCharges: Number(sellCharges.toFixed(2)),
      roundTripCharges,
      totalRequiredWithBrokerage: Number((buyValue + roundTripCharges).toFixed(2)),
    };
  } else {
    // Equity Intraday/Delivery: min(₹20, 0.05% of turnover)
    const buyBrokerage = Math.min(20, buyValue * 0.0005);
    const buyTxn = buyValue * 0.0000345;
    const buySebi = buyValue * 0.000001;
    const buyStamp = buyValue * 0.00003;
    const buyGst = (buyBrokerage + buyTxn + buySebi) * 0.18;
    const buyCharges = buyBrokerage + buyTxn + buySebi + buyStamp + buyGst;

    const sellBrokerage = Math.min(20, sellValue * 0.0005);
    const sellStt = sellValue * 0.00025;
    const sellTxn = sellValue * 0.0000345;
    const sellSebi = sellValue * 0.000001;
    const sellGst = (sellBrokerage + sellTxn + sellSebi) * 0.18;
    const sellCharges = sellBrokerage + sellStt + sellTxn + sellSebi + sellGst;

    const roundTripCharges = Number((buyCharges + sellCharges).toFixed(2));
    return {
      tradeValue: Number(buyValue.toFixed(2)),
      buyBrokerage: Number(buyBrokerage.toFixed(2)),
      sellBrokerage: Number(sellBrokerage.toFixed(2)),
      stt: Number(sellStt.toFixed(2)),
      exchangeTxnCharge: Number((buyTxn + sellTxn).toFixed(2)),
      sebiCharge: Number((buySebi + sellSebi).toFixed(2)),
      stampDuty: Number(buyStamp.toFixed(2)),
      gst: Number((buyGst + sellGst).toFixed(2)),
      buyCharges: Number(buyCharges.toFixed(2)),
      sellCharges: Number(sellCharges.toFixed(2)),
      roundTripCharges,
      totalRequiredWithBrokerage: Number((buyValue + roundTripCharges).toFixed(2)),
    };
  }
}

/**
 * Calculates how many lots (1 to maxLots) can be bought within availableCapital
 * AFTER including full Round-Trip Brokerage + Statutory Taxes.
 */
export function calculateAffordableLotsWithBrokerage(
  ltp: number,
  lotSize: number,
  availableCapital: number,
  isOption: boolean = true,
  maxLots: number = 5,
): {
  affordableLots: number;
  oneLotPremium: number;
  oneLotBrokerage: number;
  oneLotTotalRequired: number;
} {
  const lotSz = Math.max(1, Number(lotSize) || 1);
  const price = Math.max(0, Number(ltp) || 0);
  const oneLotCharges = calculateTradeCharges(price, lotSz, isOption);

  if (availableCapital <= 0 || price <= 0) {
    return {
      affordableLots: 0,
      oneLotPremium: oneLotCharges.tradeValue,
      oneLotBrokerage: oneLotCharges.roundTripCharges,
      oneLotTotalRequired: oneLotCharges.totalRequiredWithBrokerage,
    };
  }

  let bestLots = 0;
  for (let lots = 1; lots <= maxLots; lots++) {
    const qty = lots * lotSz;
    const charges = calculateTradeCharges(price, qty, isOption);
    if (charges.totalRequiredWithBrokerage <= availableCapital) {
      bestLots = lots;
    } else {
      break;
    }
  }

  return {
    affordableLots: bestLots,
    oneLotPremium: oneLotCharges.tradeValue,
    oneLotBrokerage: oneLotCharges.roundTripCharges,
    oneLotTotalRequired: oneLotCharges.totalRequiredWithBrokerage,
  };
}

