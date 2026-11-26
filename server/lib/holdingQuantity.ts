// Upstox holdings quantity reconciliation (settled vs sold-today units).
/**
 * Matches Upstox Holdings UI quantity calculation:
 * When holdings have been sold today (cnc_used_quantity > 0), subtract sold units
 * from settled quantity so sold holdings show actual remaining shares (e.g. 0 or 14)
 * rather than double-counting t1_quantity + already-sold holdings.
 */
export function computeEffectiveHoldingQuantity(rawHolding: any): {
  remainingQty: number;
  soldTodayQty: number;
  rawTotalQty: number;
} {
  const baseQty = Math.max(0, Number(rawHolding?.quantity || 0));
  const cncUsedQty = Math.max(0, Number(rawHolding?.cnc_used_quantity || 0));
  const t1Qty = Math.max(0, Number(rawHolding?.t1_quantity || 0));
  const colQty = Math.max(0, Number(rawHolding?.collateral_quantity || 0));

  const remainingQty =
    cncUsedQty > 0
      ? Math.max(0, baseQty - cncUsedQty)
      : baseQty + t1Qty > 0
        ? baseQty + t1Qty
        : colQty;

  return {
    remainingQty,
    soldTodayQty: cncUsedQty,
    rawTotalQty: baseQty + t1Qty,
  };
}
