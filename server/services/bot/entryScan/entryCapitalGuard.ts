// Entry capital guard: blocks a candidate when the live margin or the virtual
// paper balance cannot fund one lot including brokerage.
import { botConfig, botLogs, paperPositions, paperTradeHistory } from '../../../state';
import { getPaperInitialCapital } from '../../persistence';

/** True when the candidate must be skipped for lack of funds. */
export function isBlockedByCapitalGuard(cand: any, liveAvailableMargin: number): boolean {
  if (botConfig.mode === 'UPSTOX_LIVE') {
    const requiredLiveEntryCash = Number(
      cand.entryRequiredCash || cand.totalRequiredCashWithBrokerage,
    );
    if (liveAvailableMargin <= 0 || requiredLiveEntryCash > liveAvailableMargin) {
      const warnMsg = `[LIVE CAPITAL GUARD] ⚠️ ബാലൻസ് കുറവായതിനാൽ (₹${liveAvailableMargin.toLocaleString('en-IN')}) പുതിയ ട്രേഡ് എടുത്തില്ല. ഗുണനിലവാരമുള്ള ട്രേഡിന് ₹${requiredLiveEntryCash.toLocaleString('en-IN')} ആവശ്യമാണ്. അനാവശ്യ OTM ട്രേഡുകൾ ഒഴിവാക്കി പണം സംരക്ഷിച്ചു.`;
      botLogs.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message: warnMsg,
        type: 'ERROR',
      });
      if (botLogs.length > 200) botLogs.length = 200;
      return true;
    }
  } else if (botConfig.mode === 'PAPER_TRADING') {
    // Paper Mode Capital Guard (consistent ₹2000 default paper capital)
    const initialBalance = getPaperInitialCapital();
    const totalRealized = paperTradeHistory
      .filter((t: any) => !t.mode || t.mode === 'PAPER_TRADING')
      .reduce(
        (acc, t) => acc + (t.netRealizedPnL ?? (t.realizedPnL || 0) - (t.brokerageCharges || 0)),
        0,
      );
    const totalInvestedInOpen = paperPositions
      .filter((p: any) => !p.mode || p.mode === 'PAPER_TRADING')
      .reduce((acc, p) => acc + p.buyPrice * p.quantity, 0);
    const currentPaperBalance = initialBalance + totalRealized - totalInvestedInOpen;

    if (cand.totalRequiredCashWithBrokerage > currentPaperBalance) {
      const warnMsg = `[PAPER CAPITAL GUARD] Cannot buy ${cand.optionSymbol}: 1 Lot requires ₹${cand.totalRequiredCashWithBrokerage.toLocaleString('en-IN')}, but virtual balance is only ₹${currentPaperBalance.toFixed(2)}. Trade blocked to prevent overleveraging.`;
      botLogs.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message: warnMsg,
        type: 'ERROR',
      });
      if (botLogs.length > 200) botLogs.length = 200;
      return true;
    }
  }

  return false;
}
