// Consolidates split exchange fills from the same Upstox order into one leg with
// one round of brokerage + taxes applied.
import { calculateTradeCharges } from '../../../src/utils/indicators';
import { compareTradeIds } from './timeUtils';

export interface ConsolidatedHistoricalLeg {
  trade_id: string;
  last_trade_id: string;
  trade_date: string;
  transaction_type: string;
  quantity: number;
  price: number;
  totalAmount: number;
  symbol: string;
  scrip_name: string;
  isin: string;
  instrument_token: string;
  strike_price: string;
  option_type: string;
  expiry: string;
  exchange: string;
  segment: string;
  legCharges: number;
}

/**
 * Merges consecutive split exchange fills from the same placed order (identical price
 * or contiguous trade_ids within 250 and <= ₹0.05 price slippage) on the same date & side,
 * then computes one-side Upstox brokerage + taxes once per consolidated order leg.
 */
export function consolidateHistoricalSplitFills(
  legs: any[],
  isOpt: boolean,
): ConsolidatedHistoricalLeg[] {
  const consolidated: ConsolidatedHistoricalLeg[] = [];
  for (const r of legs) {
    const qty = Number(r.quantity || 0);
    const px = Number(r.price || (qty > 0 ? Number(r.amount || 0) / qty : 0));
    const amt = Number(r.amount || qty * px);
    if (qty <= 0 || px <= 0) continue;

    const tx = String(r.transaction_type || '').toUpperCase();
    const date = String(r.trade_date || '');
    const tid = String(r.trade_id || '');
    const prev = consolidated[consolidated.length - 1];

    if (prev && prev.trade_date === date && prev.transaction_type === tx) {
      const nCur = Number(tid);
      const nPrev = Number(prev.last_trade_id);
      const idDiff =
        tid !== '' && prev.last_trade_id !== '' && Number.isFinite(nCur) && Number.isFinite(nPrev)
          ? Math.abs(nCur - nPrev)
          : 999999;
      const pxDiff = Math.abs(px - prev.price);

      if (pxDiff <= 0.005 || (pxDiff <= 0.05 && idDiff <= 250)) {
        prev.totalAmount += amt;
        prev.quantity += qty;
        prev.price = prev.totalAmount / prev.quantity;
        prev.last_trade_id = tid;
        continue;
      }
    }

    consolidated.push({
      trade_id: tid,
      last_trade_id: tid,
      trade_date: date,
      transaction_type: tx,
      quantity: qty,
      price: px,
      totalAmount: amt,
      symbol: String(r.symbol || '').trim(),
      scrip_name: String(r.scrip_name || '').trim(),
      isin: String(r.isin || '').trim(),
      instrument_token: String(r.instrument_token || '').trim(),
      strike_price: String(r.strike_price || '').trim(),
      option_type: String(r.option_type || '').trim(),
      expiry: String(r.expiry || '').trim(),
      exchange: String(r.exchange || '').trim(),
      segment: String(r.segment || '').trim(),
      legCharges: 0,
    });
  }

  for (const leg of consolidated) {
    const legCtx = leg.instrument_token || leg.exchange || leg.symbol;
    const breakdown = calculateTradeCharges(leg.price, leg.quantity, isOpt, leg.price, legCtx);
    leg.legCharges = leg.transaction_type === 'BUY' ? breakdown.buyCharges : breakdown.sellCharges;
  }

  return consolidated;
}
