import { useEffect } from 'react';
import type { OptionChainData, Position, StockQuote } from '../types';

interface UseLivePositionMarksParams {
  quotes: StockQuote[];
  optionChainData: OptionChainData | null;
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
}

// Reprices open positions from live quotes (and option chain strikes) on every tick.
export const useLivePositionMarks = ({
  quotes,
  optionChainData,
  setPositions,
}: UseLivePositionMarksParams) => {
  useEffect(() => {
    if (quotes.length === 0) return;

    // A. Update open positions MTM P&L (supports both Equity/Index and Option Strikes via optionChainData or quotes)
    setPositions((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((pos) => {
        let currentLTP = pos.currentLTP;
        const isOpt = pos.symbol.includes('CE') || pos.symbol.includes('PE');

        if (isOpt) {
          // 1. Check if live quote exists directly for the option instrumentKey
          const directOptQuote = quotes.find(
            (item) => item.instrumentKey === pos.instrumentKey || item.symbol === pos.symbol,
          );
          if (directOptQuote && directOptQuote.ltp > 0 && directOptQuote.ltp < pos.buyPrice * 50) {
            currentLTP = directOptQuote.ltp;
          } else if (optionChainData && optionChainData.strikes?.length > 0) {
            // 2. Match strike from live Option Chain data
            const strikeMatch = pos.symbol.match(/(\d+)\s*(CE|PE)/i);
            if (strikeMatch) {
              const strikeNum = Number(strikeMatch[1]);
              const optType = strikeMatch[2].toUpperCase();
              const row = optionChainData.strikes.find((s) => s.strikePrice === strikeNum);
              if (row) {
                const chainLtp = optType === 'CE' ? row.callLTP : row.putLTP;
                if (chainLtp > 0) currentLTP = chainLtp;
              }
            }
          }
        } else {
          const q = quotes.find(
            (item) => pos.symbol.startsWith(item.symbol) || item.symbol === pos.symbol,
          );
          if (q && q.ltp > 0) currentLTP = q.ltp;
        }

        const isBuy = pos.type === 'BUY' || !pos.type;
        const hasValidEntry = Number(pos.buyPrice || 0) > 0;
        const pnl = hasValidEntry
          ? isBuy
            ? (currentLTP - pos.buyPrice) * pos.quantity
            : (pos.buyPrice - currentLTP) * pos.quantity
          : Number(pos.pnl ?? 0);
        const pnlPercent = hasValidEntry ? (pnl / (pos.buyPrice * pos.quantity)) * 100 : 0;
        const nextPnl = Number(pnl.toFixed(2));
        const nextPnlPercent = Number(pnlPercent.toFixed(2));
        const nextHighestLTP = Math.max(pos.highestLTP || pos.buyPrice, currentLTP);
        const highestPnl = Math.max((pos as any).highestPnl || 0, pnl);
        if (
          pos.currentLTP === currentLTP &&
          pos.pnl === nextPnl &&
          pos.pnlPercent === nextPnlPercent &&
          pos.highestLTP === nextHighestLTP &&
          (pos as any).highestPnl === highestPnl
        ) {
          return pos;
        }
        changed = true;
        return {
          ...pos,
          currentLTP,
          pnl: nextPnl,
          pnlPercent: nextPnlPercent,
          highestLTP: nextHighestLTP,
          highestPnl,
        };
      });
      return changed ? next : prev;
    });
  }, [quotes, optionChainData, setPositions]);
};
