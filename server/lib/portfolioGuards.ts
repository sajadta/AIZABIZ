// Instrument and position guards shared by the portfolio normalizers.

export function isOptionInstrument(symbol?: string, instrumentToken?: string): boolean {
  const sym = String(symbol || '');
  const tok = String(instrumentToken || '');
  return /\b(CE|PE)\b/i.test(sym) || sym.includes('CE') || sym.includes('PE') || tok.includes('FO');
}

/**
 * In Indian cash equity (NSE/BSE), short-selling on DELIVERY ("D") is impossible.
 * Upstox returns an entry in /v2/portfolio/short-term-positions with product === "D"
 * and negative net quantity (e.g. TRIDENT qty: -39, buy_price: 0) strictly to represent
 * "Holding sold today" from the user's Demat holdings.
 * Treating it as an active short trade causes phantom -900+ MTM loss, fake SL alerts,
 * and dangerous buy-back attempts on square-off.
 */
export function isDeliverySoldHoldingPosition(rawPos: any): boolean {
  if (!rawPos) return false;
  const sym = String(rawPos.trading_symbol || rawPos.symbol || '');
  const tok = String(rawPos.instrument_token || rawPos.instrumentKey || '');
  if (isOptionInstrument(sym, tok)) return false;

  const prodRaw = String(rawPos.product || rawPos.productType || 'D').toUpperCase();
  const isDelivery = prodRaw === 'D' || prodRaw === 'DELIVERY' || prodRaw === 'CNC';
  if (!isDelivery) return false;

  // For raw Upstox positions, net qty is negative.
  if (rawPos.quantity !== undefined || rawPos.net_quantity !== undefined) {
    const netQty = Number(rawPos.quantity ?? rawPos.net_quantity ?? 0);
    if (netQty < 0) return true;
  }

  // For already-mapped app Position objects: productType === "DELIVERY" & type === "SELL".
  if (String(rawPos.type || '').toUpperCase() === 'SELL' && isDelivery) {
    return true;
  }

  return false;
}
