// Bot tick position phase: delegates each active position to the option or equity
// exit engine (trailing stops, peak-lock, theta-decay exits, live square-off).
import { botSignals, getLastTradeExitTime, getCachedUpstoxLiveMargin } from '../../state';
import { getUnderlyingOptionInstrumentKey, shouldHoldOvernightBTST } from '../../lib/instruments';
import { handleShortOptionExit, isShortOptionPosition } from './positionMonitor/shortOptionExit';
import { monitorEquityPosition } from './positionMonitor/equityExit';
import { monitorOptionPosition } from './positionMonitor/optionExit';

export async function monitorActivePositions(ctx: {
  token: string;
  activePositions: any[];
  liveQuotesMap: any;
  isEodSquareOff: boolean;
}): Promise<void> {
  const { token, activePositions, liveQuotesMap, isEodSquareOff } = ctx;
  for (const pos of activePositions) {
    let quoteObj = liveQuotesMap[pos.instrumentKey];
    if (!quoteObj) {
      quoteObj = Object.values(liveQuotesMap).find(
        (q: any) => q && q.instrument_token === pos.instrumentKey,
      );
    }
    if (quoteObj && Number(quoteObj.last_price) > 0) {
      // Fix: Do not update currentLTP if it is ridiculously higher than buyPrice for options (to prevent 5 lakh profit glitch)
      if (pos.isOption && quoteObj.last_price > pos.buyPrice * 50) {
        // Probably underlying index price instead of option premium
      } else {
        pos.currentLTP = Number(quoteObj.last_price);
        const isShortPos = pos.type === 'SELL' || pos.transactionType === 'SELL';
        pos.pnl = Number(
          (
            (isShortPos ? pos.buyPrice - pos.currentLTP : pos.currentLTP - pos.buyPrice) *
            pos.quantity
          ).toFixed(2),
        );
      }
    }

    const underlyingKeyForPos =
      pos.underlyingInstrumentKey || getUnderlyingOptionInstrumentKey(pos.symbol || '');
    const latestUnderlyingSig = botSignals.find(
      (s) =>
        s.underlyingInstrumentKey === underlyingKeyForPos ||
        getUnderlyingOptionInstrumentKey(s.symbol || '') === underlyingKeyForPos,
    );
    const isBtstHoldRecommended =
      pos.productType === 'DELIVERY' && shouldHoldOvernightBTST(pos, latestUnderlyingSig);
    pos.isBtstHoldRecommended = isBtstHoldRecommended;

    // Option-selling positions run their own theta-decay exit engine.
    if (isShortOptionPosition(pos)) {
      await handleShortOptionExit(pos, { token, isEodSquareOff, isBtstHoldRecommended });
      continue;
    }

    if (
      (pos.type === 'BUY' && (pos.symbol.includes('CE') || pos.symbol.includes('PE'))) ||
      pos.isOption
    ) {
      await monitorOptionPosition(pos, {
        token,
        isEodSquareOff,
        isBtstHoldRecommended,
        quoteObj,
        latestUnderlyingSig,
        activePositions,
      });
      continue;
    }

    // Dedicated Equity Stocks (Cash & Intraday) Position & Trailing Profit Lock Engine
    if (await monitorEquityPosition(pos, { token, isEodSquareOff })) {
      continue;
    }
  }
}
