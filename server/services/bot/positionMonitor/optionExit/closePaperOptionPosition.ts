// Paper-mode square-off bookkeeping: closes the position, mirrors it into trade
// history, and stamps the paired buy order so the Orders tab shows real P&L.
import { paperOrders, paperPositions, paperTradeHistory } from '../../../../state';
import { savePostgresDb } from '../../../persistence';

export interface ClosePaperOptionParams {
  pos: any;
  finalExecExitPrice: number;
  finalGrossPnL: number;
  finalBrokerage: number;
  finalNetPnL: number;
  sellReason: string;
}

export function closePaperOptionPosition(params: ClosePaperOptionParams): void {
  const { pos, finalExecExitPrice, finalGrossPnL, finalBrokerage, finalNetPnL, sellReason } =
    params;

  const closedPos = paperPositions.find((p) => p.id === pos.id);
  if (closedPos) {
    closedPos.currentLTP = finalExecExitPrice;
    closedPos.sellPrice = finalExecExitPrice;
    closedPos.highestLTP = Math.max(
      closedPos.highestLTP || closedPos.buyPrice,
      pos.highestLTP || closedPos.buyPrice,
      finalExecExitPrice,
    );
    closedPos.pnl = finalGrossPnL;
    closedPos.realizedPnL = finalGrossPnL;
    closedPos.brokerageCharges = finalBrokerage;
    closedPos.netRealizedPnL = finalNetPnL;
    closedPos.exitReason = sellReason;
    closedPos.closeTime = new Date().toISOString();
    closedPos.mode = 'PAPER_TRADING';
    paperTradeHistory.unshift(closedPos);
    if (paperTradeHistory.length > 200) paperTradeHistory.length = 200;
    paperOrders.unshift({
      id: 'ORD' + Date.now(),
      orderId: 'PAP_' + Date.now().toString().slice(-6),
      positionId: closedPos.id,
      symbol: closedPos.symbol,
      instrumentKey: closedPos.instrumentKey,
      transactionType: 'SELL',
      type: 'SELL',
      orderType: 'MARKET',
      productType: closedPos.productType || 'INTRADAY',
      quantity: closedPos.quantity,
      buyPrice: closedPos.buyPrice,
      sellPrice: finalExecExitPrice,
      price: finalExecExitPrice,
      executedPrice: finalExecExitPrice,
      realizedPnL: finalGrossPnL,
      brokerageCharges: finalBrokerage,
      netRealizedPnL: finalNetPnL,
      status: 'COMPLETE',
      timestamp: new Date().toLocaleTimeString('en-IN'),
      time: new Date().toISOString(),
      mode: 'PAPER_TRADING',
    });
    // Also stamp the corresponding BUY order with the closed trade's exit price and P&L so Orders tab NEVER shows ₹0.00!
    const matchingBuyOrder = paperOrders.find(
      (o) =>
        o.transactionType === 'BUY' &&
        (o.positionId === closedPos.id || (o.symbol === closedPos.symbol && !o.sellPrice)),
    );
    if (matchingBuyOrder) {
      matchingBuyOrder.sellPrice = finalExecExitPrice;
      matchingBuyOrder.realizedPnL = finalGrossPnL;
      matchingBuyOrder.brokerageCharges = finalBrokerage;
      matchingBuyOrder.netRealizedPnL = finalNetPnL;
    }
  }
  paperPositions.splice(0, paperPositions.length, ...paperPositions.filter((p) => p.id !== pos.id));
  savePostgresDb().catch(() => {
    /* ignore */
  });
}
