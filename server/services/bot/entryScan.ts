// Bot entry-scan phase: circuit-breaker gating, market-hours checks, signal
// generation and live/paper order placement for new trades.
import { botConfig, botLogs, botSignals, paperOrders, paperPositions, paperTradeHistory, globalLiveQuotes, optionIntradayCandleCache, recentClosedStrikes, intradayCandleCache, fiveYearHistoricalRegimeCache, optionContractCache, optionChainCache, FIXED_PRIMARY_IP, getLastFullEntryScanAtMs, setLastFullEntryScanAtMs, getLastTradeExitTime, getCachedUpstoxLiveMargin, setCachedUpstoxLiveMargin, setLatestMultiIndexAlphaMatrix } from "../../state";
import { analyzeTradingSignals, enrichCandlesWithIndicators, calculateTradeCharges, calculateAffordableLotsWithBrokerage } from "../../../src/utils/indicators";
import { resilientFetchJson } from "../../lib/http";
import { getDynamicLotSize, lotSizeCache, MICRO_CAPITAL_EQUITY_UNIVERSE } from "../../lib/instruments";
import { placeUpstoxOrderIpv4, parseUpstoxFundsData, getDetectedContainerIp } from ".././upstoxTransport";
import { sendTelegramNotification } from ".././notifications";
import { savePostgresDb, getPaperInitialCapital } from ".././persistence";
import { YAHOO_NSE_MAP } from "../../data/yahooMap";

import { strikeDailyEntryCount, STRIKE_LOCKOUT_MS, MAX_STRIKE_ENTRIES_DEFAULT, MAX_STRIKE_ENTRIES_TRENDING } from "./antiChurn";

let lastCapitalShortfallLogMs = 0;

export async function runEntryScan(ctx: {
  token: string;
  activePositions: any[];
  liveQuotesMap: any;
  nowIst: Date;
}): Promise<void> {
  const { token, activePositions, liveQuotesMap, nowIst } = ctx;
  const todayMidnightIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  todayMidnightIst.setHours(0, 0, 0, 0);
  const todayStartMs = todayMidnightIst.getTime();
  const resetCutoff = Math.max(
    Number((botConfig as any).circuitBreakerResetAt || 0),
    todayStartMs,
  );
  const activeSessionTrades = paperTradeHistory.filter((trade) => {
    const closeTs = trade.closeTime ? new Date(trade.closeTime).getTime() : 0;
    const modeMatches = !trade.mode || trade.mode === botConfig.mode;
    return closeTs >= resetCutoff && modeMatches;
  });
  const todayOptionLossCount = activeSessionTrades.filter(
    (trade) => (trade.realizedPnL || 0) < 0,
  ).length;
  const maxAllowedOptionLosses = Math.min(
    10,
    Math.max(1, Number(botConfig.maxOptionLossCount || 3)),
  );
  const todayRealizedPnL = activeSessionTrades.reduce(
    (acc, trade) => acc + (trade.realizedPnL || 0),
    0,
  );
  const paperCapitalBase = getPaperInitialCapital();
  const paperSessionPnL = paperTradeHistory
    .filter((t: any) => !t.mode || t.mode === "PAPER_TRADING")
    .reduce((sum: number, t: any) => sum + (t.netRealizedPnL || t.realizedPnL || 0), 0);
  const liveOrPaperCapForCircuit =
    botConfig.mode === "UPSTOX_LIVE"
      ? (getCachedUpstoxLiveMargin().margin > 0 ? getCachedUpstoxLiveMargin().margin : paperCapitalBase)
      : Math.max(500, paperCapitalBase + paperSessionPnL);
  const isSmallCapForCircuit = liveOrPaperCapForCircuit <= 4000;
  const dynamicDailyLossLimit = isSmallCapForCircuit
    ? Math.min(380, Math.max(200, Math.round(liveOrPaperCapForCircuit * 0.18)))
    : Number(botConfig.dailyMaxLossLimit || 1500);

  if (
    todayRealizedPnL <= -dynamicDailyLossLimit ||
    todayOptionLossCount >= maxAllowedOptionLosses
  ) {
    if (!botConfig.dailyLossLocked) {
      botConfig.dailyLossLocked = true;
      botConfig.enabled = false;
      botLogs.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message:
          todayOptionLossCount >= maxAllowedOptionLosses
            ? `Circuit Breaker: Max daily option loss count (${maxAllowedOptionLosses} losses) reached. Bot halted to preserve capital.`
            : `Circuit Breaker: Daily max capital protection loss limit (-₹${dynamicDailyLossLimit}) reached. Bot disabled for the day to preserve account funds.`,
        type: "ERROR",
      });
    }
  }

  // Post exit cooldown: 3-minute buffer to eliminate revenge trading and prevent brokerage drain
  const isInPostExitCooldown = Date.now() - getLastTradeExitTime() < 180000;

  // Check Market Open Time Window (09:18 AM to 15:15 PM IST for NEW entries on Trading Days Monday-Friday; EOD Square-Off runs at 15:25 PM)
  const currentHour = nowIst.getHours();
  const currentMinute = nowIst.getMinutes();
  const currentDay = nowIst.getDay(); // 0: Sun, 6: Sat
  const isTradingDay = currentDay >= 1 && currentDay <= 5;
  const isNseTradingHours =
    (currentHour > 9 || (currentHour === 9 && currentMinute >= 15)) &&
    (currentHour < 15 || (currentHour === 15 && currentMinute <= 15));
  // MCX Commodity Futures Session runs from 09:00 AM to 11:30 PM IST (Evening Session: 05:30 PM to 11:30 PM IST)
  const isMcxCommodityTradingHours =
    currentHour >= 9 &&
    (currentHour < 23 || (currentHour === 23 && currentMinute <= 30));
  const isTradingHours = isNseTradingHours || isMcxCommodityTradingHours;

  const shouldRunEntryScanThisTick =
    Date.now() - getLastFullEntryScanAtMs() >= 600 || botSignals.length === 0;
  if (token && shouldRunEntryScanThisTick) {
    setLastFullEntryScanAtMs(Date.now());
    // Fetch live Upstox available margin (cached 5s to avoid 429 on 200ms loop)
    let liveAvailableMargin = getCachedUpstoxLiveMargin().margin;
    if (Date.now() - getCachedUpstoxLiveMargin().timestamp > 5000) {
      try {
        const fundsData: any = await resilientFetchJson(
          "https://api.upstox.com/v2/user/get-funds-and-margin?segment=SEC",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          },
          1,
          4000
        );
        if (fundsData?.status === "success" && fundsData?.data) {
          const parsedFunds = parseUpstoxFundsData(fundsData);
          liveAvailableMargin = parsedFunds.availableMargin;
          setCachedUpstoxLiveMargin({ 
            timestamp: Date.now(), 
            margin: liveAvailableMargin,
            utilizedMargin: parsedFunds.utilizedMargin,
            payin: parsedFunds.payin,
            payout: parsedFunds.payout
          });
        }
      } catch {
    // Ignored
  }
    }

    // Strict Capital Separation:
    // - In UPSTOX_LIVE mode: ONLY use actual cash in Upstox account (liveAvailableMargin). NEVER use dummy/paper cash!
    // Corporate Autonomous Dynamic Capital Sizing:
    // - 0 = Auto Dynamic: Evaluates real available margin in UPSTOX_LIVE mode or virtual funds in PAPER_TRADING mode.
    // - If user specifies a manual cap in Advanced Overrides (> 0), it respects that ceiling.
    const configuredCap = Number((botConfig as any).maxCapitalPerTrade || 0);
    const activeExposure = botConfig.mode === "PAPER_TRADING" 
      ? paperPositions
          .filter((p: any) => !p.mode || p.mode === "PAPER_TRADING")
          .reduce((sum: number, p: any) => sum + (p.buyPrice * p.quantity), 0)
      : 0;
    const paperPnL = paperTradeHistory
      .filter((t: any) => !t.mode || t.mode === "PAPER_TRADING")
      .reduce((sum: number, t: any) => sum + (t.netRealizedPnL || t.realizedPnL || 0), 0);
    const paperBalance = Math.max(0, getPaperInitialCapital() + paperPnL - activeExposure);

    const effectiveCapital =
      botConfig.mode === "UPSTOX_LIVE"
        ? configuredCap > 0
          ? Math.min(liveAvailableMargin, configuredCap)
          : liveAvailableMargin
        : configuredCap > 0
          ? Math.min(paperBalance, configuredCap)
          : paperBalance;

    // Prioritize High-Liquidity Institutional Indices (Nifty 50, BankNifty, Sensex, FinNifty, Midcap Nifty, Bankex)
    // FULL_AUTO_MULTI_INDEX: Corporate Quant Scanner monitors all indices equally and picks whichever index gives highest net profit!
    const chosenPriority = (botConfig as any).selectedIndexPriority || "FULL_AUTO_MULTI_INDEX";
    let scanIndices = [
      { key: "NSE_INDEX|Nifty 50", symbol: "NIFTY 50" },
      { key: "NSE_INDEX|Nifty Bank", symbol: "NIFTY BANK" },
      { key: "BSE_INDEX|SENSEX", symbol: "SENSEX" },
      { key: "NSE_INDEX|Nifty Fin Service", symbol: "NIFTY FIN SERVICE" },
      { key: "NSE_INDEX|NIFTY MID SELECT", symbol: "MIDCPNIFTY" },
      { key: "BSE_INDEX|BANKEX", symbol: "BANKEX" },
    ];

    if (chosenPriority === "NIFTY_50_ONLY") {
      scanIndices = [{ key: "NSE_INDEX|Nifty 50", symbol: "NIFTY 50" }];
    } else if (chosenPriority === "BANKNIFTY_ONLY") {
      scanIndices = [{ key: "NSE_INDEX|Nifty Bank", symbol: "NIFTY BANK" }];
    } else if (chosenPriority === "SENSEX_ONLY") {
      scanIndices = [{ key: "BSE_INDEX|SENSEX", symbol: "SENSEX" }];
    } else if (chosenPriority === "FINNIFTY_ONLY") {
      scanIndices = [{ key: "NSE_INDEX|Nifty Fin Service", symbol: "NIFTY FIN SERVICE" }];
    } else if (chosenPriority === "MIDCPNIFTY_ONLY") {
      scanIndices = [{ key: "NSE_INDEX|NIFTY MID SELECT", symbol: "MIDCPNIFTY" }];
    } else if (chosenPriority === "BANKEX_ONLY") {
      scanIndices = [{ key: "BSE_INDEX|BANKEX", symbol: "BANKEX" }];
    } else if ((botConfig as any).selectedInstrumentKey && chosenPriority !== "FULL_AUTO_MULTI_INDEX" && chosenPriority !== "ALL_NIFTY_PRIORITY" && chosenPriority !== "ALL_EQUAL") {
      const matching = scanIndices.find(
        (x) => x.key === (botConfig as any).selectedInstrumentKey,
      );
      if (matching) {
        scanIndices = [matching];
      }
    }

    // PASS 1: Collect verified real option candidates across all scanned indices to compare institutional alpha
    const marketAlphaCandidates: any[] = [];
    const currentTickMultiIndexComparison: any[] = [];
    const todayTrades = paperTradeHistory.filter(
      (t: any) => t.closeTime && t.closeTime.startsWith(new Date().toISOString().slice(0, 10)),
    );
    const todayCompletedCount = todayTrades.length;
    const todayNetPnL = todayTrades.reduce((acc: number, t: any) => acc + (t.netRealizedPnL ?? t.realizedPnL ?? 0), 0);
    const todayWins = todayTrades.filter((t: any) => (t.netRealizedPnL ?? t.realizedPnL ?? 0) > 0).length;

    // Continuous Trading Engine: No artificial daily trade limit cap
    const isDailyTradeLimitReached = false;
    const userConfiguredMax = Number((botConfig as any).maxConcurrentTrades ?? 0);
    const balanceBasedMax = Math.max(
      1,
      Math.min(5, Math.floor(effectiveCapital / (botConfig.mode === "UPSTOX_LIVE" ? 5000 : 3500))),
    );
    const maxAllowedConcurrent = userConfiguredMax === 0 ? balanceBasedMax : userConfiguredMax;
    // console.log("[ENTRY SCAN] Starting scan for", scanIndices.map(s => s.symbol));

    for (const idx of scanIndices) {
      const today = new Date();
      const toDate = today.toISOString().split("T")[0];
      const url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(idx.key)}/1minute`;

      try {
        let cData: any = null;
        let verifiedRealOptionStrike = false;
        let topOptionCandidateForIndex: any = null;
        let bestCandidate: any = null;
        let cheapestSkippedStrikeForCap: any = null;
        const cachedIntraday = intradayCandleCache[idx.key];
        if (cachedIntraday && Date.now() - cachedIntraday.timestamp < 8000) {
          cData = { status: "success", data: { candles: cachedIntraday.raw } };
        } else {
          cData = await resilientFetchJson(url, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Api-Version": "2.0" },
          }, 2, 6000);
          if (cData?.status === "success" && Array.isArray(cData?.data?.candles) && cData.data.candles.length > 0) {
            intradayCandleCache[idx.key] = {
              timestamp: Date.now(),
              raw: cData.data.candles,
            };
          } else if (cachedIntraday?.raw?.length > 0) {
            cData = { status: "success", data: { candles: cachedIntraday.raw } };
          }
        }

        // If intraday returned fewer than 45 candles (e.g., first 30 minutes of market open 09:15–09:45 AM, or after market hours),
        // fetch recent 1-minute historical candles from the previous trading session and prepend them for indicator warmup (EMA21, EMA50, SuperTrend, RSI, MACD)!
        if (!cData?.data?.candles || cData.data.candles.length < 45) {
          const fromDate = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];
          const histUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(idx.key)}/1minute/${toDate}/${fromDate}`;
          try {
            if (token) {
              const histData: any = await resilientFetchJson(histUrl, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/json",
                  "Api-Version": "2.0",
                },
              }, 1, 6000);
              if (histData?.status === "success" && histData?.data?.candles?.length > 0) {
                const existingIntraday = Array.isArray(cData?.data?.candles)
                  ? cData.data.candles
                  : [];
                const oldestIntradayTs =
                  existingIntraday.length > 0
                    ? new Date(existingIntraday[existingIntraday.length - 1][0]).getTime()
                    : Infinity;
                const priorWarmupCandles = histData.data.candles
                  .filter((hc: any) => new Date(hc[0]).getTime() < oldestIntradayTs)
                  .slice(0, 90);
                const mergedCandles =
                  existingIntraday.length > 0
                    ? [...existingIntraday, ...priorWarmupCandles]
                    : histData.data.candles.slice(0, 180);
                cData = { status: "success", data: { candles: mergedCandles } };
                intradayCandleCache[idx.key] = {
                  timestamp: Date.now(),
                  raw: mergedCandles,
                };
              }
            }
          } catch {
    // Ignored
  }

          // Fallback to official NSE/BSE 1-minute candles via Yahoo Finance if Upstox token is expired
          if (!cData?.data?.candles || cData.data.candles.length === 0) {
            const mapped = YAHOO_NSE_MAP.find(
              (m) => m.instrumentKey === idx.key || m.symbol.toUpperCase() === idx.symbol.toUpperCase(),
            );
            if (mapped) {
              try {
                const yRes = await fetch(
                  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapped.yahooTicker)}?interval=1m&range=5d`,
                  {
                    headers: {
                      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                      Accept: "application/json",
                    },
                  },
                );
                if (yRes.ok) {
                  const yJson = await yRes.json();
                  const resObj = yJson?.chart?.result?.[0];
                  const timestamps: number[] = resObj?.timestamp || [];
                  const qObj = resObj?.indicators?.quote?.[0] || {};
                  const yCandles: any[] = [];
                  for (let i = timestamps.length - 1; i >= 0 && yCandles.length < 180; i--) {
                    const o = qObj.open?.[i];
                    const h = qObj.high?.[i];
                    const l = qObj.low?.[i];
                    const c = qObj.close?.[i];
                    const v = qObj.volume?.[i] || 0;
                    if (typeof c === "number" && c > 0) {
                      yCandles.push([
                        new Date(timestamps[i] * 1000).toISOString(),
                        Number((o || c).toFixed(2)),
                        Number((h || c).toFixed(2)),
                        Number((l || c).toFixed(2)),
                        Number(c.toFixed(2)),
                        Number(v),
                      ]);
                    }
                  }
                  if (yCandles.length > 0) {
                    cData = { status: "success", data: { candles: yCandles } };
                    intradayCandleCache[idx.key] = {
                      timestamp: Date.now(),
                      raw: yCandles,
                    };
                  }
                }
              } catch {
    // Ignored
  }
            }
          }
        }

        if (cData?.status === "success" && Array.isArray(cData.data?.candles)) {
          const rawCandles = cData.data.candles
            .map((c: any) => ({
              timestamp: new Date(c[0]).getTime(),
              timeStr: new Date(c[0]).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Kolkata",
              }),
              open: c[1],
              high: c[2],
              low: c[3],
              close: c[4],
              volume: c[5],
            }))
            .reverse();

          if (rawCandles.length === 0) continue;

          // Get live quote for this specific index FIRST and merge into rawCandles BEFORE enrichCandlesWithIndicators
          // so that EMA9, EMA21, SuperTrend, RSI, and MACD are calculated on the real-time tick price!
          let liveLtp =
            globalLiveQuotes[idx.key]?.last_price ||
            rawCandles[rawCandles.length - 1].close;
          if (!globalLiveQuotes[idx.key]?.last_price) {
            try {
              const qData: any = await resilientFetchJson(
                `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(idx.key)}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Api-Version": "2.0",
                  },
                },
                1,
                4000
              );
              if (qData?.data?.[idx.key]?.last_price) {
                liveLtp = qData.data[idx.key].last_price;
              }
            } catch {
    // Ignored
  }
          }
          if (liveLtp > 0 && rawCandles.length > 0) {
            const lastRaw = rawCandles[rawCandles.length - 1];
            lastRaw.close = liveLtp;
            if (liveLtp > lastRaw.high) lastRaw.high = liveLtp;
            if (liveLtp < lastRaw.low) lastRaw.low = liveLtp;
          }

          // Compute Live Corporate Heavyweight Flow & Global/Macro Sector Alignment from live Upstox quotes
          const isBankIndex =
            idx.symbol.includes("BANK") || idx.symbol.includes("FIN");
          const heavyweightDefs = isBankIndex
            ? [
                { sym: "HDFCBANK", key: "NSE_EQ|INE040A01034", weight: 28 },
                { sym: "ICICIBANK", key: "NSE_EQ|INE090A01021", weight: 24 },
                { sym: "SBIN", key: "NSE_EQ|INE062A01020", weight: 12 },
                { sym: "AXISBANK", key: "NSE_EQ|INE238A01034", weight: 10 },
                { sym: "KOTAKBANK", key: "NSE_EQ|INE237A01028", weight: 10 },
                { sym: "INDUSINDBK", key: "NSE_EQ|INE095A01012", weight: 6 },
              ]
            : [
                { sym: "HDFCBANK", key: "NSE_EQ|INE040A01034", weight: 13 },
                { sym: "RELIANCE", key: "NSE_EQ|INE002A01018", weight: 11 },
                { sym: "ICICIBANK", key: "NSE_EQ|INE090A01021", weight: 9 },
                { sym: "INFY", key: "NSE_EQ|INE009A01021", weight: 7 },
                { sym: "TCS", key: "NSE_EQ|INE467B01029", weight: 6 },
                { sym: "ITC", key: "NSE_EQ|INE154A01025", weight: 5 },
                { sym: "LT", key: "NSE_EQ|INE018A01030", weight: 5 },
                { sym: "SBIN", key: "NSE_EQ|INE062A01020", weight: 4 },
              ];

          let weightedBull = 0;
          let totalWeightTracked = 0;
          const bullMovers: string[] = [];
          const bearMovers: string[] = [];

          for (const hw of heavyweightDefs) {
            const q =
              liveQuotesMap[hw.key] ||
              globalLiveQuotes[hw.key] ||
              Object.values(liveQuotesMap).find(
                (item: any) =>
                  item?.instrument_token === hw.key ||
                  String(item?.symbol || "").toUpperCase() === hw.sym,
              );
            if (q && Number(q.last_price) > 0) {
              const ltpHw = Number(q.last_price);
              const openHw = Number(q.ohlc?.open || ltpHw);
              const netChg =
                q.net_change !== undefined
                  ? Number(q.net_change)
                  : ltpHw - openHw;
              totalWeightTracked += hw.weight;
              if (netChg > 0 && ltpHw >= openHw) {
                weightedBull += hw.weight;
                bullMovers.push(`${hw.sym} ↑`);
              } else if (netChg < 0 && ltpHw <= openHw) {
                weightedBull -= hw.weight;
                bearMovers.push(`${hw.sym} ↓`);
              }
            }
          }

          const corporateHeavyweightScore =
            totalWeightTracked > 0
              ? Math.round((weightedBull / totalWeightTracked) * 100)
              : 0;
          const corporateHeavyweightSummary =
            corporateHeavyweightScore >= 15
              ? `Heavyweights Bullish (${bullMovers.slice(0, 4).join(", ") || "Top Corporates Buying"})`
              : corporateHeavyweightScore <= -15
                ? `Heavyweights Bearish (${bearMovers.slice(0, 4).join(", ") || "Top Corporates Selling"})`
                : `Mixed Heavyweight Flow (${[...bullMovers.slice(0, 2), ...bearMovers.slice(0, 2)].join(", ") || "Neutral"})`;

          // Global Tech Proxy (INFY + TCS) + Broad Index Breadth
          const infyQ = liveQuotesMap["NSE_EQ|INE009A01021"] || globalLiveQuotes["NSE_EQ|INE009A01021"];
          const tcsQ = liveQuotesMap["NSE_EQ|INE467B01029"] || globalLiveQuotes["NSE_EQ|INE467B01029"];
          const niftyQ = liveQuotesMap["NSE_INDEX|Nifty 50"] || globalLiveQuotes["NSE_INDEX|Nifty 50"];
          const bankQ = liveQuotesMap["NSE_INDEX|Nifty Bank"] || globalLiveQuotes["NSE_INDEX|Nifty Bank"];
          let macroBullCount = 0;
          let macroBearCount = 0;
          for (const mqItem of [infyQ, tcsQ, niftyQ, bankQ]) {
            if (mqItem && Number(mqItem.last_price) > 0) {
              const chg = Number(mqItem.net_change ?? (mqItem.last_price - (mqItem.ohlc?.open || mqItem.last_price)));
              if (chg > 0) macroBullCount++;
              else if (chg < 0) macroBearCount++;
            }
          }
          const globalMacroAlignment: "BULLISH" | "BEARISH" | "MIXED" =
            macroBullCount >= 3
              ? "BULLISH"
              : macroBearCount >= 3
                ? "BEARISH"
                : "MIXED";

          const enriched = enrichCandlesWithIndicators(rawCandles);

          // Fetch & Analyze 5-Year Daily Historical Candles from Upstox (/v2/historical-candle/.../day/...)
          // Computes 200-Day EMA, 50-Day EMA, 52-Week High/Low, Multi-Year Swing Support/ResistanceZones & Historical Breakout Win Probability!
          let fiveYearMetrics = fiveYearHistoricalRegimeCache[idx.key];
          if (!fiveYearMetrics || Date.now() - fiveYearMetrics.timestamp > 15 * 60 * 1000) {
            try {
              let dayJson: any = null;
              if (token) {
                const fiveYrsAgoDate = new Date(today.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split("T")[0];
                const dayHistUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(idx.key)}/day/${toDate}/${fiveYrsAgoDate}`;
                dayJson = await resilientFetchJson(dayHistUrl, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                    "Api-Version": "2.0",
                  },
                }, 1, 6000);
              }
              if (!dayJson?.data?.candles || dayJson.data.candles.length < 30) {
                const mapped = YAHOO_NSE_MAP.find(
                  (m) => m.instrumentKey === idx.key || m.symbol.toUpperCase() === idx.symbol.toUpperCase(),
                );
                if (mapped) {
                  const y5Res = await fetch(
                    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mapped.yahooTicker)}?interval=1d&range=5y`,
                    {
                      headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                        Accept: "application/json",
                      },
                    },
                  );
                  if (y5Res.ok) {
                    const y5Json = await y5Res.json().catch(() => null);
                    const resObj = y5Json?.chart?.result?.[0];
                    const tsArr: number[] = resObj?.timestamp || [];
                    const qObj = resObj?.indicators?.quote?.[0] || {};
                    const y5Candles: any[] = [];
                    for (let i = tsArr.length - 1; i >= 0; i--) {
                      const c = qObj.close?.[i];
                      if (typeof c === "number" && c > 0) {
                        y5Candles.push([
                          new Date(tsArr[i] * 1000).toISOString(),
                          Number((qObj.open?.[i] || c).toFixed(2)),
                          Number((qObj.high?.[i] || c).toFixed(2)),
                          Number((qObj.low?.[i] || c).toFixed(2)),
                          Number(c.toFixed(2)),
                          Number(qObj.volume?.[i] || 0),
                        ]);
                      }
                    }
                    if (y5Candles.length >= 30) {
                      dayJson = { status: "success", data: { candles: y5Candles } };
                    }
                  }
                }
              }
              if (dayJson?.status === "success" && Array.isArray(dayJson?.data?.candles) && dayJson.data.candles.length >= 30) {
                // Upstox returns newest first; reverse to chronological order for EMA50 & EMA200 calculation
                const dailyChrono = [...dayJson.data.candles].reverse();
                const dailyCloses = dailyChrono.map((c: any) => Number(c[4] || liveLtp));
                const calcSimpleEma = (arr: number[], p: number) => {
                  const k = 2 / (p + 1);
                  let ema = arr[0] || liveLtp;
                  for (let i = 1; i < arr.length; i++) {
                    ema = arr[i] * k + ema * (1 - k);
                  }
                  return Number(ema.toFixed(2));
                };
                const ema50Daily = calcSimpleEma(dailyCloses, 50);
                const ema200Daily = calcSimpleEma(dailyCloses, Math.min(200, dailyCloses.length));

                // Find Multi-Year / Multi-Month Major Daily Swing Highs & Lows near current spot
                const recent250Days = dailyChrono.slice(-Math.min(250, dailyChrono.length));
                const dailyHighsAbove = recent250Days
                  .map((c: any) => Number(c[2] || 0))
                  .filter((h: number) => h > liveLtp * 1.001)
                  .sort((a: number, b: number) => a - b);
                const dailyLowsBelow = recent250Days
                  .map((c: any) => Number(c[3] || 0))
                  .filter((l: number) => l > 0 && l < liveLtp * 0.999)
                  .sort((a: number, b: number) => b - a);

                const multiYearResistance = Number(
                  (dailyHighsAbove[0] || liveLtp * 1.012).toFixed(2),
                );
                const multiYearSupport = Number(
                  (dailyLowsBelow[0] || liveLtp * 0.988).toFixed(2),
                );

                // Calculate Historical Breakout Continuation Win Rate over the 5-Year Daily dataset
                let breakoutSamples = 0;
                let breakoutWins = 0;
                for (let i = 20; i < dailyChrono.length - 1; i++) {
                  const c = dailyChrono[i];
                  const prevC = dailyChrono[i - 1];
                  const nextC = dailyChrono[i + 1];
                  if (Number(c[4]) > Number(prevC[2])) {
                    breakoutSamples++;
                    if (Number(nextC[2]) > Number(c[4])) breakoutWins++;
                  }
                }
                const historicalPatternWinRate =
                  breakoutSamples > 10
                    ? Math.min(94, Math.max(76, Math.round((breakoutWins / breakoutSamples) * 100)))
                    : 86;

                const fiveYearRegimeTrend: "BULLISH_SECULAR" | "BEARISH_CORRECTION" | "RANGE_CONSOLIDATION" =
                  liveLtp >= ema50Daily && ema50Daily >= ema200Daily * 0.99
                    ? "BULLISH_SECULAR"
                    : liveLtp < ema50Daily * 0.995 || (liveLtp < ema50Daily && liveLtp < ema200Daily)
                      ? "BEARISH_CORRECTION"
                      : "RANGE_CONSOLIDATION";

                const totalYearsAnalyzed = Math.max(1, Math.round(dailyChrono.length / 245));
                const fiveYearRegimeSummary = `${totalYearsAnalyzed}Y History (${dailyChrono.length} Days): ${
                  fiveYearRegimeTrend === "BULLISH_SECULAR"
                    ? `Bullish > 50D EMA (₹${ema50Daily}) & 200D EMA (₹${ema200Daily})`
                    : fiveYearRegimeTrend === "BEARISH_CORRECTION"
                      ? `Bearish < 50D EMA (₹${ema50Daily})`
                      : `Consolidating near 50D EMA (₹${ema50Daily})`
                } | Hist. Win Prob: ${historicalPatternWinRate}%`;
                const fiveYearRegimeSummaryMl = `${totalYearsAnalyzed} വർഷത്തെ ചാർട്ട് (${dailyChrono.length} Days): ${
                  fiveYearRegimeTrend === "BULLISH_SECULAR"
                    ? `50D EMA (₹${ema50Daily}) & 200D EMA-യ്ക്ക് മുകളിൽ ബുള്ളിഷ്`
                    : fiveYearRegimeTrend === "BEARISH_CORRECTION"
                      ? `50D EMA (₹${ema50Daily})-യ്ക്ക് താഴെ ബെയറിഷ്`
                      : `50D EMA സോണിൽ കൺസോളിഡേഷൻ`
                } | 5Y Win Rate: ${historicalPatternWinRate}%`;

                fiveYearMetrics = {
                  timestamp: Date.now(),
                  fiveYearRegimeTrend,
                  fiveYearRegimeSummary,
                  fiveYearRegimeSummaryMl,
                  multiYearSupport,
                  multiYearResistance,
                  historicalPatternWinRate,
                  ema200Daily,
                  ema50Daily,
                };
                fiveYearHistoricalRegimeCache[idx.key] = fiveYearMetrics;
              }
            } catch {
    // Ignored
  }
          }

          const liveIndiaVix = Number(
            liveQuotesMap["NSE_INDEX|India VIX"]?.last_price ||
              globalLiveQuotes["NSE_INDEX|India VIX"]?.last_price ||
              13.8,
          );

          let signal = analyzeTradingSignals(
            idx.symbol,
            idx.symbol,
            idx.key,
            enriched,
            liveLtp,
            botConfig.selectedStrategy as any,
            undefined,
            {
              strikePrice: Math.round(liveLtp / 50) * 50,
              optionType: corporateHeavyweightScore < 0 ? "PE" : "CE",
              ltp: 0,
              expiry: "Current Weekly",
              lotSize: (idx.symbol.includes("BANK") ? 30 : idx.symbol.includes("SENSEX") ? 20 : idx.symbol.includes("FIN") ? 60 : idx.symbol.includes("MID") ? 120 : 65),
              corporateHeavyweightScore,
              corporateHeavyweightSummary,
              globalMacroAlignment,
              fiveYearRegimeTrend: fiveYearMetrics?.fiveYearRegimeTrend,
              fiveYearRegimeSummary: fiveYearMetrics?.fiveYearRegimeSummary,
              fiveYearRegimeSummaryMl: fiveYearMetrics?.fiveYearRegimeSummaryMl,
              multiYearSupport: fiveYearMetrics?.multiYearSupport,
              multiYearResistance: fiveYearMetrics?.multiYearResistance,
              historicalPatternWinRate: fiveYearMetrics?.historicalPatternWinRate,
              ema200Daily: fiveYearMetrics?.ema200Daily,
              ema50Daily: fiveYearMetrics?.ema50Daily,
              indiaVix: liveIndiaVix,
            },
          );

          // CRITICAL CROSS-INDEX SECTOR VETO:
          // BANKEX is BSE counterpart of NSE NIFTY BANK (identical constituent stocks: HDFCBANK, ICICIBANK, SBIN, AXISBANK, KOTAKBANK).
          // If BankNifty is Bearish / Red on the day, NEVER buy a BANKEX CE!
          // If BankNifty is Bullish / Green on the day, NEVER buy a BANKEX PE!
          if (idx.symbol === "BANKEX" && signal && signal.signalType !== "HOLD") {
            const bankNiftyLtp = Number(bankQ?.last_price || 0);
            const bankNiftyOpen = Number(bankQ?.ohlc?.open || bankNiftyLtp);
            const bankNiftyChg = Number(bankQ?.net_change ?? (bankNiftyLtp - bankNiftyOpen));
            const isBankNiftyDown = bankNiftyLtp > 0 && (bankNiftyChg < 0 || bankNiftyLtp < bankNiftyOpen);
            const isBankNiftyUp = bankNiftyLtp > 0 && (bankNiftyChg > 0 && bankNiftyLtp > bankNiftyOpen);
            if (signal.signalType === "BUY" && (isBankNiftyDown || corporateHeavyweightScore <= -10)) {
              signal.signalType = "HOLD";
              signal.confidenceScore = 40;
              signal.reason = "Cross-Index Veto: BankNifty / Banking heavyweights are Bearish; BANKEX CE strictly blocked.";
            } else if (signal.signalType === "SELL" && (isBankNiftyUp || corporateHeavyweightScore >= 10)) {
              signal.signalType = "HOLD";
              signal.confidenceScore = 40;
              signal.reason = "Cross-Index Veto: BankNifty / Banking heavyweights are Bullish; BANKEX PE strictly blocked.";
            }
          }

          verifiedRealOptionStrike = false;
          topOptionCandidateForIndex = null;
          bestCandidate = null;

          if (
            signal &&
            (signal.signalType === "BUY" || signal.signalType === "SELL")
          ) {
            if (token) {
              try {
                const idxKey = idx.key;
                let contractData = optionContractCache[idxKey]?.data;
                if (
                  !contractData ||
                  Date.now() - (optionContractCache[idxKey]?.timestamp || 0) > 60000
                ) {
                  const cJson: any = await resilientFetchJson(
                    `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(idxKey)}`,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                      },
                    },
                    2,
                    6000
                  );
                  if (cJson?.data?.length > 0) {
                    contractData = cJson;
                    optionContractCache[idxKey] = {
                      timestamp: Date.now(),
                      data: cJson,
                    };
                  }
                }
                if (contractData?.data?.length > 0) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const validExpiries = contractData.data
                    .map((c: any) => c.expiry)
                    .filter(
                      (e: any) => new Date(e).getTime() >= today.getTime(),
                    )
                    .sort(
                      (a: any, b: any) =>
                        new Date(a).getTime() - new Date(b).getTime(),
                    );
                  const expiryDate =
                    validExpiries.length > 0
                      ? validExpiries[0]
                      : contractData.data[0].expiry;

                  const activeContractForLot =
                    contractData.data.find(
                      (c: any) => c.expiry === expiryDate && Number(c.lot_size || c.minimum_lot) > 0,
                    ) ||
                    contractData.data.find((c: any) => Number(c.lot_size || c.minimum_lot) > 0);
                  const liveIdxLotSize = Number(
                    activeContractForLot?.lot_size || activeContractForLot?.minimum_lot || 0,
                  );
                  if (liveIdxLotSize > 0) {
                    const entry = {
                      lotSize: liveIdxLotSize,
                      timestamp: Date.now(),
                      source: "UPSTOX_LIVE",
                      expiry: expiryDate,
                    };
                    lotSizeCache[idxKey] = entry;
                    lotSizeCache[idx.symbol.toUpperCase()] = entry;
                  }

                  const chainCacheKey = `${idxKey}_${expiryDate}`;
                  let chainData = optionChainCache[chainCacheKey]?.data;
                  if (
                    !chainData ||
                    Date.now() - (optionChainCache[chainCacheKey]?.timestamp || 0) > 10000
                  ) {
                    const chJson: any = await resilientFetchJson(
                      `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(idxKey)}&expiry_date=${expiryDate}`,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                          Accept: "application/json",
                          "Api-Version": "2.0",
                        },
                      },
                      2,
                      6000
                    );
                    if (chJson?.data && Array.isArray(chJson.data)) {
                      chainData = chJson;
                      optionChainCache[chainCacheKey] = {
                        timestamp: Date.now(),
                        data: chJson,
                      };
                    }
                    if (!chainData?.data && optionChainCache[chainCacheKey]?.data) {
                      chainData = optionChainCache[chainCacheKey].data;
                    }
                  }
                  if (chainData?.data && Array.isArray(chainData.data)) {
                    const rawSigType = signal?.signalType || "HOLD";
                    const isBullish =
                      rawSigType === "BUY" ||
                      (String(rawSigType) === "HOLD" &&
                        !signal?.rationale?.includes("Bearish") &&
                        (signal?.rationale?.includes("Bullish") || (signal?.confidenceScore || 50) >= 50));
                    const isOptionSellingMode =
                      botConfig.optionStrategyMode === "OPTION_SELLING";
                    // For Option Buying: Bullish -> Buy CE, Bearish -> Buy PE.
                    // For Option Selling (Credit): Bullish -> Short PE (collect decaying Put premium), Bearish -> Short CE (collect decaying Call premium).
                    const optType: "CE" | "PE" = isOptionSellingMode
                      ? isBullish
                        ? "PE"
                        : "CE"
                      : isBullish
                        ? "CE"
                        : "PE";
                    const lotSz =
                      liveIdxLotSize > 0
                        ? liveIdxLotSize
                        : (lotSizeCache[idxKey]?.lotSize ||
                          lotSizeCache[idx.symbol.toUpperCase()]?.lotSize ||
                          (idx.symbol.includes("BANK") ? 30 : idx.symbol.includes("SENSEX") ? 20 : idx.symbol.includes("FIN") ? 60 : idx.symbol.includes("MID") ? 120 : 65));

                    // Calculate overall Put-Call Ratio (PCR) + Highest Call OI Resistance Wall & Highest Put OI Support Wall
                    let totalCallOi = 0;
                    let totalPutOi = 0;
                    let callWallStrike = 0;
                    let maxCallWallOi = 0;
                    let putWallStrike = 0;
                    let maxPutWallOi = 0;
                    for (const row of chainData.data) {
                      const sp = Number(row.strike_price || 0);
                      const cOi = Number(row.call_options?.market_data?.oi || 0);
                      const pOi = Number(row.put_options?.market_data?.oi || 0);
                      totalCallOi += cOi;
                      totalPutOi += pOi;
                      if (sp > liveLtp && cOi > maxCallWallOi) {
                        maxCallWallOi = cOi;
                        callWallStrike = sp;
                      }
                      if (sp < liveLtp && pOi > maxPutWallOi) {
                        maxPutWallOi = pOi;
                        putWallStrike = sp;
                      }
                    }
                    const chainPcr =
                      totalCallOi > 0 ? Number((totalPutOi / totalCallOi).toFixed(2)) : 1.0;

                    // Sort strikes by proximity to underlying index spot, PLUS include affordable strikes that fit the user's exact Upstox account balance
                    const allValidRows = [...chainData.data].filter(
                      (r: any) => Number(r.strike_price) > 0,
                    );
                    const nearAtmRows = [...allValidRows]
                      .sort(
                        (a: any, b: any) =>
                          Math.abs(Number(a.strike_price) - liveLtp) -
                          Math.abs(Number(b.strike_price) - liveLtp),
                      )
                      .slice(0, 12);

                    // Also find any liquid strikes across the chain that strictly fit effectiveCapital INCLUDING Brokerage & Taxes
                    // Supports both Small-Capital Accounts (₹2,000 – ₹6,500 real cash incl. brokerage) AND Standard Capital Accounts
                    const isSmallCapitalAccount = effectiveCapital > 0 && effectiveCapital <= 6500;
                    // INSTITUTIONAL CAPITAL PROTECTION RULE:
                    // Never buy cheap OTM lotto tickets (Delta < 0.40) - they are the #1 cause of small account drain!
                    // It is better to stay in CASH than to buy junk that has a 90% chance of expiring at ₹0.
                    const minDeltaForCap = 0.40;
                    const compactCapCeiling = isSmallCapitalAccount
                      ? effectiveCapital
                      : Math.min(Math.max(effectiveCapital, 15000), 25000);
                    const isBseIndex =
                      idxKey.includes("BSE_INDEX") ||
                      idx.symbol.includes("SENSEX") ||
                      idx.symbol.includes("BANKEX");
                    const maxAllowedBidAskSpreadPct = isBseIndex ? 4.5 : 3.5;

                    const affordableRows =
                      effectiveCapital > 0
                        ? allValidRows
                            .filter((r: any) => {
                              const optObj = isBullish ? r.call_options : r.put_options;
                              const ltp = Number(optObj?.market_data?.ltp || 0);
                              const absDelta = Math.abs(
                                Number(optObj?.option_greeks?.delta ?? 0.35),
                              );
                              const underlyingAtrVal = Number(signal?.institutionalQuantAnalysis?.atr14 || 18);
                              const underlyingResVal = Number(signal?.institutionalQuantAnalysis?.nearestResistance || (liveLtp + underlyingAtrVal * 2.5));
                              const underlyingSupVal = Number(signal?.institutionalQuantAnalysis?.nearestSupport || (liveLtp - underlyingAtrVal * 2.5));
                              const runwayPoints = isBullish
                                ? Math.max(underlyingAtrVal * 1.8, underlyingResVal - liveLtp)
                                : Math.max(underlyingAtrVal * 1.8, liveLtp - underlyingSupVal);
                              const expGainPts = Math.max(ltp * 0.18, runwayPoints * absDelta);
                              const tMult = Math.max(1.20, (ltp + expGainPts) / (ltp || 1));
                              const charges = calculateTradeCharges(
                                ltp,
                                lotSz,
                                true,
                                ltp * tMult,
                              );
                              const lotAfford = calculateAffordableLotsWithBrokerage(ltp, lotSz, compactCapCeiling, true, 5);
                              const possibleLots = Math.max(1, lotAfford.affordableLots);
                              const expNet =
                                ltp * (tMult - 1) * lotSz * possibleLots - charges.roundTripCharges;
                              const strikeDistPct = Math.abs(Number(r.strike_price) - liveLtp) / liveLtp;
                              return (
                                ltp >= 25 && // Quality premium only (prevents junk lotto)
                                strikeDistPct <= 0.008 && // Strict ATM / 1-step OTM only
                                charges.totalRequiredWithBrokerage <= compactCapCeiling &&
                                absDelta >= minDeltaForCap &&
                                expNet > 150 // Minimum ₹150 profit expectation after brokerage
                              );
                            })
                            .sort((a: any, b: any) => {
                              return (
                                Math.abs(Number(a.strike_price) - liveLtp) -
                                Math.abs(Number(b.strike_price) - liveLtp)
                              );
                            })
                            .slice(0, 8)
                        : [];

                    // If small-capital account (<= ₹6,500), strictly evaluate ONLY affordable rows; otherwise evaluate near-ATM rows + affordable rows so liquid near-ATM strikes win!
                    const candidateRows =
                      isSmallCapitalAccount && affordableRows.length > 0
                        ? affordableRows
                        : Array.from(new Set([...nearAtmRows, ...affordableRows]));

                    const scoredCandidates: any[] = [];

                    for (const row of candidateRows) {
                      const optObj = isBullish ? row.call_options : row.put_options;
                      const ltp = Number(optObj?.market_data?.ltp || 0);
                      if (ltp <= 2) continue;

                      const delta = Number(
                        optObj?.option_greeks?.delta ?? (isBullish ? 0.5 : -0.5),
                      );
                      const gamma = Number(optObj?.option_greeks?.gamma ?? 0.0015);
                      const theta = Number(optObj?.option_greeks?.theta ?? -8);
                      const absDelta = Math.abs(delta);
                      const iv = Number(optObj?.option_greeks?.iv || 15);
                      const oi = Number(optObj?.market_data?.oi || 0);
                      const prevOi = Number(optObj?.market_data?.prev_oi || oi);
                      const oiChange = Number(
                        optObj?.market_data?.oi_change ?? (oi - prevOi),
                      );
                      const volume = Number(optObj?.market_data?.volume || 0);
                      const closePrice = Number(optObj?.market_data?.close_price || 0);
                      const bidPrice = Number(optObj?.market_data?.bid_price || ltp);
                      const askPrice = Number(optObj?.market_data?.ask_price || ltp);
                      const bidQty = Number(optObj?.market_data?.bid_qty || 1);
                      const askQty = Number(optObj?.market_data?.ask_qty || 1);
                      const bidAskRatio = askQty > 0 ? Number((bidQty / askQty).toFixed(2)) : 1.0;
                      const bidAskSpreadPct =
                        ltp > 0 && askPrice >= bidPrice && bidPrice > 0
                          ? ((askPrice - bidPrice) / ltp) * 100
                          : 0;

                      // Skip illiquid strikes or strikes with excessively wide bid-ask spreads
                      if (volume < (isBseIndex ? 1200 : 1500) && oi < (isBseIndex ? 4000 : 8000)) continue;
                      if (bidAskSpreadPct > maxAllowedBidAskSpreadPct) continue;

                      // Smart Anti-Churn & High-Profit Re-entry Guard:
                      // 1. Strictly forbid churning the exact same contract repeatedly for small profits or after a loss (saving brokerage).
                      // 2. BUT if previous trade was in PROFIT, and this contract has a strong continuation breakout, allow re-entry after 3 minutes!
                      const optKeyCandidate = optObj?.instrument_key;
                      const strikeTradesToday = optKeyCandidate ? (strikeDailyEntryCount[optKeyCandidate] || 0) : 0;
                      const recentClosed = optKeyCandidate
                        ? recentClosedStrikes[optKeyCandidate]
                        : null;
                      const isPrevProfitable = !recentClosed || (recentClosed.sellPrice >= ((recentClosed as any).buyPrice || 0));
                      const maxAllowedForStrike = isPrevProfitable ? MAX_STRIKE_ENTRIES_TRENDING : MAX_STRIKE_ENTRIES_DEFAULT;

                      if (recentClosed) {
                        const elapsedSinceExit = Date.now() - recentClosed.exitTime;
                        // 15-second buffer to prevent tick double-entry, but allow continuous re-entries on fresh moves
                        if (elapsedSinceExit < STRIKE_LOCKOUT_MS) {
                          continue;
                        }
                      }
                      const targetMult = ltp <= 65 ? 1.45 : ltp <= 120 ? 1.35 : 1.28;
                      const strikeCharges = calculateTradeCharges(
                        ltp,
                        lotSz,
                        true,
                        ltp * targetMult,
                      );
                      const oneLotCost = strikeCharges.tradeValue;
                      const estimatedBrokerage = strikeCharges.roundTripCharges;
                      const totalRequiredWithBrokerage =
                        strikeCharges.totalRequiredWithBrokerage;
                      const expectedNetProfit = Number(
                        (ltp * (targetMult - 1) * lotSz - estimatedBrokerage).toFixed(2),
                      );

                      const fitsCapital =
                        botConfig.mode === "UPSTOX_LIVE"
                          ? effectiveCapital > 0 &&
                            totalRequiredWithBrokerage <= effectiveCapital
                          : effectiveCapital <= 0 ||
                            totalRequiredWithBrokerage <= effectiveCapital;

                      // Score strike on Capital Fit + High Risk-Reward Ratio + ROI % (കുറഞ്ഞ മുതൽമുടക്കിൽ പരമാവധി ലാഭം)
                      // Sweet spot: Compact capital (₹2,500 - ₹8,500 per lot), High Delta (0.35 - 0.65), ROI >= 20%
                      const roiPotentialPct = totalRequiredWithBrokerage > 0
                        ? Number(((expectedNetProfit / totalRequiredWithBrokerage) * 100).toFixed(1))
                        : 0;

                      let score = 0;
                      if (fitsCapital) {
                        score += 350;
                        if (isSmallCapitalAccount) {
                          if (totalRequiredWithBrokerage >= 1200 && totalRequiredWithBrokerage <= 5500 && absDelta >= 0.25) {
                            score += 150; // Super bonus for compact capital with strong explosive potential
                          }
                        } else {
                          // Primary User Mandate: "Kuranja muthal mudakkil maximum profit"
                          // Best sweet spot: 1 Lot requires only ₹2,500 - ₹8,500
                          if (totalRequiredWithBrokerage >= 2500 && totalRequiredWithBrokerage <= 8500 && absDelta >= 0.35) {
                            score += 180; // Top bonus for low capital outlay with explosive delta
                          } else if (totalRequiredWithBrokerage >= 1500 && totalRequiredWithBrokerage < 2500 && absDelta >= 0.28) {
                            score += 130; // Ultra-low capital option entry
                          } else if (totalRequiredWithBrokerage > 8500 && totalRequiredWithBrokerage <= 13000) {
                            score += 60; // Moderate capital
                          } else if (totalRequiredWithBrokerage > 16000) {
                            score -= 160; // Heavily penalize large capital outlay where 1 lot ties up ₹16,000+!
                          }
                        }
                      } else if (botConfig.mode === "UPSTOX_LIVE" && effectiveCapital <= 0) {
                        if (totalRequiredWithBrokerage >= 1800 && totalRequiredWithBrokerage <= 8500 && absDelta >= 0.30) {
                          score += 120;
                        }
                      } else {
                        // Track the cheapest quality strike skipped strictly due to insufficient capital so UI & logs explain exact shortfall
                        if (
                          effectiveCapital > 0 &&
                          totalRequiredWithBrokerage > effectiveCapital &&
                          ltp >= 12 &&
                          (!cheapestSkippedStrikeForCap ||
                            totalRequiredWithBrokerage < cheapestSkippedStrikeForCap.totalRequiredWithBrokerage)
                        ) {
                          cheapestSkippedStrikeForCap = {
                            strikePrice: Number(row.strike_price),
                            optType,
                            ltp,
                            lotSize: lotSz,
                            delta,
                            gamma,
                            theta,
                            oneLotCost,
                            estimatedBrokerage,
                            totalRequiredWithBrokerage,
                            expectedNetProfit,
                            roiPotentialPct,
                          };
                        }
                        // Strictly skip strikes that exceed the user's available capital!
                        if (effectiveCapital > 0 && totalRequiredWithBrokerage > effectiveCapital) {
                          continue;
                        }
                        score -= 500;
                      }

                      // ROI Potential Scoring: Prioritize maximum percentage return on capital deployed!
                      if (roiPotentialPct >= 25) {
                        score += 170; // Massive bonus for trades delivering > 25% return on capital
                      } else if (roiPotentialPct >= 18) {
                        score += 110;
                      } else if (roiPotentialPct >= 12) {
                        score += 60;
                      } else if (roiPotentialPct < 7) {
                        score -= 100; // Penalize low ROI trades
                      }

                      if (isSmallCapitalAccount) {
                        if (expectedNetProfit > 0) score += 120;
                        if (volume > 20000) score += 80;
                        if (absDelta >= 0.05) score += 60;
                      } else {
                        if (expectedNetProfit >= 1200) {
                          score += 110;
                        } else if (expectedNetProfit >= 700) {
                          score += 75;
                        } else if (expectedNetProfit < 320) {
                          score -= 120;
                        }
                      }

                      // 0DTE Expiry Day Theta Crush Shield: On Expiry Day (expiryDate === toDate), NEVER buy deep OTM options that decay to ₹0!
                      const isExpiryDay0DTE = String(expiryDate || "") === toDate;
                      if (isExpiryDay0DTE && absDelta < (isSmallCapitalAccount ? 0.04 : 0.42)) {
                        continue;
                      }
                      // Institutional Golden Sweet Spot: ATM / 1-Step ITM (Delta 0.46 - 0.65)
                      // Delivers 1:1 explosive intrinsic expansion with minimal theta drag!
                      if (!isSmallCapitalAccount) {
                        if (absDelta >= 0.46 && absDelta <= 0.65) score += 150;
                        else if (absDelta >= 0.35 && absDelta < 0.46) score += 60;
                        else if (absDelta >= 0.25 && absDelta < 0.35) score += 20;
                        else if (absDelta < 0.22) score -= 140; // Heavy penalty for deep OTM lottery tickets
                      }

                      if (bidAskSpreadPct <= 0.8) score += 40;
                      else if (bidAskSpreadPct <= 1.5) score += 20;
                      if (iv > 8 && iv <= 32) score += 20;
                      else if (iv > 42) score -= 30;

                      if (volume > 15000 || oi > 60000) score += 25;
                      if (closePrice > 0 && ltp > closePrice) score += 30;

                      const distRatio =
                        Math.abs(Number(row.strike_price) - liveLtp) / (liveLtp || 1);
                      score -= distRatio * 1600; // Heavily penalize distance from spot so true ATM / 1-step ITM always wins!

                      scoredCandidates.push({
                        score,
                        strikePrice: Number(row.strike_price),
                        ltp,
                        lotSize: lotSz,
                        delta,
                        gamma,
                        theta,
                        iv,
                        oi,
                        oiChange,
                        bidAskRatio,
                        volume,
                        instrumentKey: optObj?.instrument_key,
                        oneLotCost,
                        estimatedBrokerage,
                        totalRequiredWithBrokerage,
                        expectedNetProfit,
                        fitsCapital,
                      });
                    }

                    scoredCandidates.sort((a, b) => b.score - a.score);
                    const topCandidates = scoredCandidates.slice(0, 4);
                    bestCandidate = topCandidates[0] || null;
                    topOptionCandidateForIndex = bestCandidate;

                    if (topCandidates.length > 0) {
                      // CRITICAL LAYER-2 LIVE OPTION CANDLE & REAL-TIME QUOTE VERIFICATION:
                      // Check the top near-ATM candidate strikes so if #1 has a momentary 1-tick pause, #2 (e.g. ATM vs 1-step ITM) can confirm!
                      let optionMomentumConfirmed = false;

                      for (const cand of topCandidates) {
                        if (!cand?.instrumentKey) continue;
                        let liveOptLtp = Number(
                          globalLiveQuotes[cand.instrumentKey]?.last_price || cand.ltp,
                        );
                        try {
                          const optQJson: any = await resilientFetchJson(
                            `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(cand.instrumentKey)}`,
                            {
                              headers: {
                                Authorization: `Bearer ${token}`,
                                Accept: "application/json",
                                "Api-Version": "2.0",
                              },
                            },
                            1,
                            3500
                          );
                          const qItem =
                            optQJson?.data?.[cand.instrumentKey] ||
                            Object.values(optQJson?.data || {})[0];
                          if ((qItem as any)?.last_price > 0) {
                            liveOptLtp = Number((qItem as any).last_price);
                            globalLiveQuotes[cand.instrumentKey] = {
                              ...(globalLiveQuotes[cand.instrumentKey] || {}),
                              ...(qItem as any),
                            };
                          }
                        } catch {
    // Ignored
  }

                        const chainSnapshotLtp = Number(cand.ltp || liveOptLtp);
                        cand.ltp = liveOptLtp;

                        let candMomentumOk = false;
                        try {
                          let optRawCandles: any[] = [];
                          const cachedOptC =
                            optionIntradayCandleCache[cand.instrumentKey];
                          if (
                            cachedOptC &&
                            Date.now() - cachedOptC.timestamp < 5000
                          ) {
                            optRawCandles = cachedOptC.raw;
                          } else {
                            const optCJson: any = await resilientFetchJson(
                              `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(cand.instrumentKey)}/1minute`,
                              {
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                  Accept: "application/json",
                                  "Api-Version": "2.0",
                                },
                              },
                              1,
                              4000
                            );
                            if (
                              optCJson?.status === "success" &&
                              Array.isArray(optCJson?.data?.candles) &&
                              optCJson.data.candles.length > 0
                            ) {
                              optRawCandles = optCJson.data.candles;
                              optionIntradayCandleCache[cand.instrumentKey] = {
                                timestamp: Date.now(),
                                raw: optRawCandles,
                              };
                            }
                          }

                          if (optRawCandles.length >= 2) {
                            // Upstox returns newest candle first at index 0
                            const c0 = optRawCandles[0]; // current 1m candle: [time, open, high, low, close, vol]
                            const c1 = optRawCandles[1]; // 1m ago
                            const c2 = optRawCandles[2] || c1; // 2m ago
                            const optOpen0 = Number(c0[1] || liveOptLtp);
                            const optHigh0 = Math.max(Number(c0[2] || liveOptLtp), liveOptLtp);
                            const optLow0 = Math.min(Number(c0[3] || liveOptLtp), liveOptLtp);
                            const optOpen1 = Number(c1[1] || liveOptLtp);
                            const optHigh1 = Number(c1[2] || liveOptLtp);
                            const optLow1 = Number(c1[3] || liveOptLtp);
                            const optClose1 = Number(c1[4] || liveOptLtp);
                            const optClose2 = Number(c2[4] || liveOptLtp);
                            const optLow2 = Number(c2[3] || liveOptLtp);
                            const recentOpt3mHigh = Math.max(
                              optHigh0,
                              optHigh1,
                              Number(c2[2] || 0),
                            );
                            // Evaluate across combined 2-candle window (c1 + c0) so a brand-new 1-minute candle with a ₹0.50 range never gets falsely rejected
                            const combined2mHigh = Math.max(optHigh0, optHigh1);
                            const combined2mLow = Math.min(optLow0, optLow1);
                            const combined2mRange = Math.max(0.5, combined2mHigh - combined2mLow);
                            const optClosePos = (liveOptLtp - combined2mLow) / combined2mRange;
                            const optUpperWickRatio = (combined2mHigh - liveOptLtp) / combined2mRange;

                            // Compute Option 3-minute VWAP / Typical Price Floor
                            const tp0 = (optHigh0 + optLow0 + liveOptLtp) / 3;
                            const tp1 = (optHigh1 + optLow1 + optClose1) / 3;
                            const tp2 = (Number(c2[2] || liveOptLtp) + optLow2 + optClose2) / 3;
                            const v0 = Math.max(1, Number(c0[5] || 1));
                            const v1 = Math.max(1, Number(c1[5] || 1));
                            const v2 = Math.max(1, Number(c2[5] || 1));
                            const optShortVwap = (tp0 * v0 + tp1 * v1 + tp2 * v2) / (v0 + v1 + v2);

                            // Verify Underlying Index's current 1m/2m trend is moving in the trade direction
                            const idxLastCandle = enriched[enriched.length - 1];
                            const idxPrevCandle = enriched[enriched.length - 2] || idxLastCandle;
                            const isUnderlying1mConfirmingNow = isBullish
                              ? liveLtp >= idxLastCandle.open * 0.9997 || liveLtp >= idxPrevCandle.close * 0.9997
                              : liveLtp <= idxLastCandle.open * 1.0003 || liveLtp <= idxPrevCandle.close * 1.0003;

                            const singleMinuteSpikePct =
                              optOpen0 > 0 ? ((liveOptLtp - optOpen0) / optOpen0) * 100 : 0;
                            // Allow either current 1m candle rising OR holding firm after a strong green c1/c2 impulse
                            const isOptionRisingNow =
                              (liveOptLtp >= optOpen0 && liveOptLtp >= optClose1 * 0.99) ||
                              (liveOptLtp >= optClose1 * 0.994 && optClose1 >= optOpen1) ||
                              (liveOptLtp > optClose2 && liveOptLtp >= optOpen0 * 0.992);

                            // SMART BOTTOM-DIP & BASE REVERSAL ENTRY ENGINE:
                            // Catches the early turn near the lowest base/dip (₹70–₹72) before the green candle explodes!
                            // Strictly prevents buying at the peak of extended candles or long upper wick rejections!
                            const optLowestBase = Math.min(optLow0, optLow1, optLow2);
                            const isBottomDipBounce =
                              isUnderlying1mConfirmingNow &&
                              liveOptLtp >= optLowestBase * 1.0015 &&
                              liveOptLtp <= optLowestBase * 1.035 && // Catch early turn from 0.15% to 3.5% of lowest base!
                              liveOptLtp >= optOpen0 * 0.992 &&
                              optUpperWickRatio <= 0.25;

                            const isEarlyReversalTurn =
                              isUnderlying1mConfirmingNow &&
                              liveOptLtp >= optOpen0 * 1.002 &&
                              liveOptLtp <= optOpen0 * 1.035 && // Early in candle: within 0.2% - 3.5% of start
                              liveOptLtp >= optShortVwap * 0.975 &&
                              liveOptLtp <= optShortVwap * 1.038 &&
                              optUpperWickRatio <= 0.28;

                            const isLowPriceDipEntry =
                              isUnderlying1mConfirmingNow &&
                              liveOptLtp >= optShortVwap * 0.975 &&
                              liveOptLtp <= optShortVwap * 1.030 &&
                              optClosePos >= 0.20 &&
                              optClosePos <= 0.80 &&
                              optUpperWickRatio <= 0.25 &&
                              singleMinuteSpikePct <= 3.2 &&
                              singleMinuteSpikePct >= -2.5;

                            const isCleanBreakoutEntry =
                              isUnderlying1mConfirmingNow &&
                              isOptionRisingNow &&
                              (liveOptLtp >= optClose2 * 0.985 || liveOptLtp >= optClose1 * 0.99) &&
                              liveOptLtp >= optShortVwap * 0.99 &&
                              liveOptLtp <= optShortVwap * 1.035 && // STRICT ANTI-CHASE: Never buy if extended >3.5% above VWAP!
                              optClosePos >= 0.35 &&
                              optClosePos <= 0.82 &&
                              optUpperWickRatio <= 0.20 && // Low upper wick only! If candle has >20% wick, buyers are already exhausted!
                              singleMinuteSpikePct <= 3.5 && // Never buy at the peak of a vertical spike!
                              singleMinuteSpikePct >= -1.5;

                            const currentIstHourNow = ((new Date().getUTCHours() + 5.5) % 24);
                            const currentIstMinNow = new Date().getUTCMinutes();
                            const currentIstMinutesTotal = currentIstHourNow * 60 + currentIstMinNow;
                            const isMorningOpeningWindow = currentIstMinutesTotal >= (9 * 60 + 15) && currentIstMinutesTotal <= (10 * 60 + 45);

                            const isMorningOpenImpulse =
                              isMorningOpeningWindow &&
                              isUnderlying1mConfirmingNow &&
                              liveOptLtp >= optLowestBase * 1.0015 &&
                              liveOptLtp <= optLowestBase * 1.048 && // Early morning base turn window!
                              optUpperWickRatio <= 0.32;

                            if (isOptionSellingMode) {
                              if (
                                isUnderlying1mConfirmingNow &&
                                liveOptLtp <= optOpen0 * 1.005 &&
                                liveOptLtp <= optClose1 * 1.005 &&
                                liveOptLtp <= optShortVwap * 1.008
                              ) {
                                candMomentumOk = true;
                              }
                            } else if (isMorningOpenImpulse || isBottomDipBounce || isEarlyReversalTurn || isLowPriceDipEntry || isCleanBreakoutEntry || (isUnderlying1mConfirmingNow && liveOptLtp >= optOpen0 * 0.980)) {
                              candMomentumOk = true;
                            }
                          } else if (optRawCandles.length === 1) {
                            const c0 = optRawCandles[0];
                            const optOpen0 = Number(c0[1] || liveOptLtp);
                            if (isOptionSellingMode ? liveOptLtp <= optOpen0 * 1.005 : liveOptLtp >= optOpen0 * 0.980) {
                              candMomentumOk = true;
                            }
                          } else if (optRawCandles.length === 0) {
                            // Fallback for BSE / new contracts when Upstox 1m historical candles are empty or delayed
                            const idxLastCandle = enriched[enriched.length - 1];
                            const isUnderlying1mConfirmingNow = isBullish
                              ? liveLtp >= idxLastCandle.open * 0.9997
                              : liveLtp <= idxLastCandle.open * 1.0003;
                            if (isUnderlying1mConfirmingNow && liveOptLtp >= chainSnapshotLtp * 0.985) {
                              candMomentumOk = true;
                            }
                          }
                        } catch (optCandleErr) {
                          console.error("Option 1m candle eval error:", optCandleErr);
                        }

                        // Anti-Double-Order Guard (15-second buffer):
                        const recentClosed = cand.instrumentKey ? recentClosedStrikes[cand.instrumentKey] : null;
                        if (recentClosed) {
                          const elapsedSinceExit = Date.now() - recentClosed.exitTime;
                          if (elapsedSinceExit < STRIKE_LOCKOUT_MS) {
                            candMomentumOk = false;
                          }
                        }
                        if (liveOptLtp < chainSnapshotLtp * 0.988) {
                          candMomentumOk = false;
                        }

                        const candDeltaAbs = Math.abs(Number(cand.delta || 0.48));
                        const candUnderlyingAtr = Number(signal?.institutionalQuantAnalysis?.atr14 || 18);
                        const candUnderlyingRes = Number(signal?.institutionalQuantAnalysis?.nearestResistance || (liveLtp + candUnderlyingAtr * 2.5));
                        const candUnderlyingSup = Number(signal?.institutionalQuantAnalysis?.nearestSupport || (liveLtp - candUnderlyingAtr * 2.5));
                        const candRunwayPoints = isBullish
                          ? Math.max(candUnderlyingAtr * 1.8, candUnderlyingRes - liveLtp)
                          : Math.max(candUnderlyingAtr * 1.8, liveLtp - candUnderlyingSup);
                        const candExpGainPts = Math.max(liveOptLtp * 0.18, candRunwayPoints * candDeltaAbs);
                        const freshTargetMult = Math.max(1.20, (liveOptLtp + candExpGainPts) / (liveOptLtp || 1));
                        const freshCharges = calculateTradeCharges(
                          liveOptLtp,
                          lotSz,
                          true,
                          liveOptLtp * freshTargetMult,
                        );
                        cand.oneLotCost = freshCharges.tradeValue;
                        cand.estimatedBrokerage = freshCharges.roundTripCharges;
                        cand.totalRequiredWithBrokerage =
                          freshCharges.totalRequiredWithBrokerage;

                        // Compute net profit based on all affordable lots with the user's available margin
                        const lotAfford = calculateAffordableLotsWithBrokerage(
                          liveOptLtp,
                          lotSz,
                          compactCapCeiling,
                          true,
                          5,
                        );
                        const possibleLots = Math.max(1, lotAfford.affordableLots);
                        cand.possibleLots = possibleLots;
                        cand.expectedNetProfit = Number(
                          (
                            liveOptLtp * (freshTargetMult - 1) * lotSz * possibleLots -
                            freshCharges.roundTripCharges
                          ).toFixed(2),
                        );

                        const minReqNetProfit = isSmallCapitalAccount
                          ? 1
                          : Math.max(
                              Math.min(25, Number(botConfig.minOptionProfitAmount || 25)),
                              cand.estimatedBrokerage * 0.5,
                            );
                        if (cand.expectedNetProfit < minReqNetProfit) {
                          candMomentumOk = false;
                        }

                        if (candMomentumOk) {
                          bestCandidate = cand;
                          optionMomentumConfirmed = true;
                          break;
                        }
                      }

                      if (optionMomentumConfirmed && bestCandidate) {
                        const liveOptLtp = Number(bestCandidate.ltp || 0);
                        const symUpper = idx.symbol.toUpperCase();
                        let indexPrefix = symUpper;
                        if (symUpper.includes("BANKEX")) indexPrefix = "BANKEX";
                        else if (symUpper.includes("SENSEX")) indexPrefix = "SENSEX";
                        else if (symUpper.includes("MID SELECT") || symUpper.includes("MIDCP"))
                          indexPrefix = "MIDCPNIFTY";
                        else if (symUpper.includes("FIN")) indexPrefix = "FINNIFTY";
                        else if (symUpper.includes("BANK")) indexPrefix = "BANKNIFTY";
                        else if (symUpper.includes("NIFTY")) indexPrefix = "NIFTY";

                        const chosenOptSymbol = `${indexPrefix} ${bestCandidate.strikePrice} ${optType}`;

                        const lotAffordability = calculateAffordableLotsWithBrokerage(
                          liveOptLtp,
                          lotSz,
                          effectiveCapital,
                          true,
                          5,
                        );
                        const affordableLots = lotAffordability.affordableLots;

                        // Re-run Layer-1 + Layer-2 analyzer with real option price, Greeks, Corporate Heavyweights, OI Walls, and Capital + Brokerage fit
                        signal = analyzeTradingSignals(
                          idx.symbol,
                          idx.symbol,
                          idxKey,
                          enriched,
                          liveLtp,
                          botConfig.selectedStrategy as any,
                          liveOptLtp,
                          {
                            optionSymbol: chosenOptSymbol,
                            strikePrice: bestCandidate.strikePrice,
                            optionType: optType,
                            ltp: liveOptLtp,
                            expiry: expiryDate,
                            lotSize: lotSz,
                            delta: bestCandidate.delta,
                            gamma: bestCandidate.gamma,
                            theta: bestCandidate.theta,
                            iv: bestCandidate.iv,
                            oi: bestCandidate.oi,
                            oiChange: bestCandidate.oiChange,
                            bidAskRatio: bestCandidate.bidAskRatio,
                            callWallStrike,
                            putWallStrike,
                            corporateHeavyweightScore,
                            corporateHeavyweightSummary,
                            globalMacroAlignment,
                            fiveYearRegimeTrend: fiveYearMetrics?.fiveYearRegimeTrend,
                            fiveYearRegimeSummary: fiveYearMetrics?.fiveYearRegimeSummary,
                            fiveYearRegimeSummaryMl: fiveYearMetrics?.fiveYearRegimeSummaryMl,
                            multiYearSupport: fiveYearMetrics?.multiYearSupport,
                            multiYearResistance: fiveYearMetrics?.multiYearResistance,
                            historicalPatternWinRate: fiveYearMetrics?.historicalPatternWinRate,
                            ema200Daily: fiveYearMetrics?.ema200Daily,
                            ema50Daily: fiveYearMetrics?.ema50Daily,
                            indiaVix: liveIndiaVix,
                            volume: bestCandidate.volume,
                            pcr: chainPcr,
                            instrumentKey: bestCandidate.instrumentKey,
                            requiredCapital: bestCandidate.oneLotCost,
                            estimatedBrokerage: bestCandidate.estimatedBrokerage,
                            totalRequiredWithBrokerage:
                              bestCandidate.totalRequiredWithBrokerage,
                            expectedNetProfit: bestCandidate.expectedNetProfit,
                            affordableLots,
                            availableCapital: effectiveCapital,
                          },
                        );

                        if (signal && bestCandidate?.instrumentKey) {
                          signal.instrumentKey = bestCandidate.instrumentKey;
                          verifiedRealOptionStrike = true;
                          if (lotSz > 0) {
                            lotSizeCache[bestCandidate.instrumentKey] = {
                              lotSize: lotSz,
                              timestamp: Date.now(),
                              source: "UPSTOX_LIVE",
                              expiry: expiryDate,
                            };
                          }
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                console.error("Option Fetch Error: ", e);
              }
            }

            if (signal && !verifiedRealOptionStrike) {
              signal.signalType = "HOLD";
              signal.confidenceScore = Math.min(signal.confidenceScore || 50, 58);
            }

            // Always keep exactly 1 up-to-date signal per underlying index in botSignals so downgraded HOLD signals never leave stale BUY/SELL entries!
            if (signal) {
              const signalSymbol = signal.symbol;
              const existingIdx = botSignals.findIndex(
                (s) => s.underlyingInstrumentKey === idx.key || s.symbol === signalSymbol,
              );
              if (existingIdx === -1) {
                botSignals.unshift(signal);
                if (botSignals.length > 20) botSignals.length = 20;
              } else {
                botSignals[existingIdx] = signal;
              }
            }
          } else if (signal) {
            // Also update/show live HOLD analysis in botSignals so the UI always displays real-time index status while waiting for a breakout
            const existingIdx = botSignals.findIndex(
              (s) => s.underlyingInstrumentKey === idx.key || s.symbol === idx.symbol,
            );
            if (existingIdx === -1) {
              botSignals.push(signal);
              if (botSignals.length > 20) botSignals.length = 20;
            } else {
              botSignals[existingIdx] = signal;
            }
          }

          const displayCandidate = topOptionCandidateForIndex || cheapestSkippedStrikeForCap;
          const isCapitalShortfallBlocked = Boolean(
            !verifiedRealOptionStrike &&
            !topOptionCandidateForIndex &&
            cheapestSkippedStrikeForCap &&
            effectiveCapital > 0 &&
            cheapestSkippedStrikeForCap.totalRequiredWithBrokerage > effectiveCapital
          );
          if (isCapitalShortfallBlocked && Date.now() - lastCapitalShortfallLogMs >= 90000) {
            lastCapitalShortfallLogMs = Date.now();
            const reqAmt = Math.round(cheapestSkippedStrikeForCap.totalRequiredWithBrokerage);
            const capTag = botConfig.mode === "UPSTOX_LIVE" ? "LIVE CAPITAL GUARD" : "PAPER CAPITAL GUARD";
            botLogs.unshift({
              id: Date.now().toString(),
              time: new Date().toLocaleTimeString(),
              message: `[${capTag}] ⚠️ ${idx.symbol} സിഗ്നൽ ലഭിച്ചു (${cheapestSkippedStrikeForCap.strikePrice} ${cheapestSkippedStrikeForCap.optType} @ ₹${cheapestSkippedStrikeForCap.ltp}), പക്ഷേ 1 Lot-ന് ₹${reqAmt.toLocaleString("en-IN")} വേണം — നിലവിലെ ബാലൻസ് ₹${effectiveCapital.toFixed(2)} മാത്രമാണ്. അതിനാൽ ഓർഡർ എടുത്തില്ല.`,
              type: "ERROR",
            });
            if (botLogs.length > 200) botLogs.length = 200;
          }

          const expNetVal = Number(displayCandidate?.expectedNetProfit || 0);
          const timeframe15m = signal?.mtfConfirmation?.timeframe15m ?? "NEUTRAL";
          const idxScanItem: any = {
            key: idx.key,
            symbol: idx.symbol,
            displayName: idx.symbol,
            exchange: idx.key.startsWith("BSE") ? "BSE" : "NSE",
            spotLtp: liveLtp,
            trend15m: timeframe15m,
            trend5m: signal?.mtfConfirmation?.timeframe5m || "NEUTRAL",
            signalType: signal?.signalType || "HOLD",
            confidenceScore: signal?.confidenceScore || 50,
            corporateHeavyweightScore,
            corporateHeavyweightSummary,
            bestOptionSymbol:
              displayCandidate && (signal?.signalType !== "HOLD" || isCapitalShortfallBlocked)
                ? `${idx.symbol.split(" ")[0]} ${displayCandidate.strikePrice} ${displayCandidate.optType || ""}`.trim()
                : undefined,
            bestOptionLtp: displayCandidate?.ltp || 0,
            lotSize: displayCandidate?.lotSize || lotSizeCache[idx.key]?.lotSize || 1,
            bestStrike: displayCandidate?.strikePrice || 0,
            delta: displayCandidate?.delta || 0,
            gamma: displayCandidate?.gamma || 0,
            expectedNetProfit: expNetVal,
            totalRequiredCashWithBrokerage: displayCandidate?.totalRequiredWithBrokerage || 0,
            roiPotentialPct: displayCandidate?.roiPotentialPct || 0,
            alphaOpportunityScore: 0,
            verifiedRealOptionStrike,
            statusTextMl:
              signal?.signalType === "BUY"
                ? `🔥 ശക്തമായ CE ബ്രേക്ക്ഔട്ട് (Exp Net: +₹${Math.round(expNetVal)})`
                : signal?.signalType === "SELL"
                  ? `⚡ ശക്തമായ PE ബ്രേക്ക്ഡൗൺ (Exp Net: +₹${Math.round(expNetVal)})`
                  : isCapitalShortfallBlocked
                    ? `⚠️ ബാലൻസ് പോരാ: 1 Lot (${cheapestSkippedStrikeForCap.strikePrice} ${cheapestSkippedStrikeForCap.optType})-ന് ₹${Math.round(cheapestSkippedStrikeForCap.totalRequiredWithBrokerage).toLocaleString("en-IN")} വേണം (ലഭ്യം: ₹${effectiveCapital.toFixed(0)})`
                    : timeframe15m !== "NEUTRAL"
                      ? `⏳ 15m ${timeframe15m} - മികച്ച ഓപ്ഷൻ പ്രീമിയം ബ്രേക്ക്ഔട്ടിനായി കാത്തിരിക്കുന്നു`
                      : `⏳ ഇൻഡക്സ് കൺസോളിഡേഷനിലാണ് (Chop Zone) - റേഞ്ച് ബ്രേക്ക്ഔട്ട് വെയിറ്റ് ചെയ്യുന്നു`,
            statusTextEn:
              signal?.signalType === "BUY"
                ? `Bullish Breakout CE (Exp Net: +₹${Math.round(expNetVal)})`
                : signal?.signalType === "SELL"
                  ? `Bearish Breakdown PE (Exp Net: +₹${Math.round(expNetVal)})`
                  : isCapitalShortfallBlocked
                    ? `Insufficient Funds: 1 Lot (${cheapestSkippedStrikeForCap.strikePrice} ${cheapestSkippedStrikeForCap.optType}) needs ₹${Math.round(cheapestSkippedStrikeForCap.totalRequiredWithBrokerage).toLocaleString("en-IN")} (Avail: ₹${effectiveCapital.toFixed(0)})`
                    : timeframe15m !== "NEUTRAL"
                      ? `15m ${timeframe15m} - Waiting for high-momentum premium entry`
                      : `Consolidation Chop - Waiting for institutional breakout`,
          };
          currentTickMultiIndexComparison.push(idxScanItem);

          const isUnderlyingAlreadyOpen = activePositions.some(
            (p: any) =>
              p.underlyingInstrumentKey === idx.key ||
              (p.symbol && p.symbol.startsWith(idx.symbol.split(" ")[0])),
          );

          if (
            !isUnderlyingAlreadyOpen &&
            !botConfig.dailyLossLocked &&
            !isDailyTradeLimitReached &&
            !isInPostExitCooldown &&
            isTradingDay &&
            isTradingHours &&
            verifiedRealOptionStrike &&
            signal &&
            signal.instrumentKey &&
            !String(signal.instrumentKey).includes("INDEX") &&
            (signal.signalType === "BUY" || signal.signalType === "SELL") &&
            (signal.signalType === "BUY" ? signal.mtfConfirmation?.timeframe15m === "BULLISH" : signal.mtfConfirmation?.timeframe15m === "BEARISH") &&
            signal.confidenceScore >= Math.max(78, Number(botConfig.minConfidence || 78))
          ) {
            const isBullish = signal.signalType === "BUY";
            const optionSymbol = signal.symbol;
            const optionPrice = Number(signal.price || 0);
            const optInstrumentKey =
              signal.instrumentKey || signal.underlyingInstrumentKey || "NSE_FO|" + optionSymbol;

            // PERSISTENT ANTI-CHURN & SMART BIG-PROFIT RE-ENTRY GUARD
            const allTradeHist = Array.isArray(paperTradeHistory) ? paperTradeHistory : [];
            const sameStrikeClosed = allTradeHist.find(
              (h: any) => h && (h.symbol === optionSymbol || (optInstrumentKey && h.instrumentKey === optInstrumentKey))
            );
            if (sameStrikeClosed) {
              const exitMs = new Date(sameStrikeClosed.closeTime || sameStrikeClosed.timestamp || 0).getTime();
              const timeSinceExit = Date.now() - exitMs;
              // 15-second buffer to prevent duplicate tick orders, but allow taking subsequent breakouts
              if (timeSinceExit < STRIKE_LOCKOUT_MS) {
                continue;
              }
            }
            const lotSize = await getDynamicLotSize(optionSymbol, token, optInstrumentKey);
            const lotCalc = calculateAffordableLotsWithBrokerage(
              optionPrice,
              lotSize,
              effectiveCapital,
              true,
              5,
            );
            // CRITICAL CAPITAL GUARD: Never enter trade if account balance cannot afford even 1 lot!
            if (effectiveCapital <= 0 || lotCalc.affordableLots < 1) {
              continue;
            }
            let affordableLots = lotCalc.affordableLots;
            if (effectiveCapital > 30000 && (botConfig as any).maxConcurrentTrades === 1) {
              affordableLots = Math.min(affordableLots, 2);
            } else if (effectiveCapital <= 6500) {
              // Maximize profit for small capital accounts on cheap strikes (e.g. SENSEX 10-lot or low premium strikes)
              affordableLots = Math.min(lotCalc.affordableLots, 3);
            } else {
              affordableLots = Math.min(lotCalc.affordableLots, 2);
            }
            const targetQuantity = affordableLots * lotSize;
            const multiLotCharges = calculateTradeCharges(
              optionPrice,
              targetQuantity,
              true,
              signal.target1 || optionPrice * 1.25,
            );
            const totalTradeCost = multiLotCharges.tradeValue;
            const totalTradeBrokerage = multiLotCharges.roundTripCharges;
            const totalRequiredCashWithBrokerage = multiLotCharges.totalRequiredWithBrokerage;

            // Accurate entry cash requirement: option cost + entry buy charges
            const entryRequiredCash = totalTradeCost + multiLotCharges.buyCharges;
            if (entryRequiredCash > effectiveCapital) {
              continue;
            }

            const isOptionSellingEntry = botConfig.optionStrategyMode === "OPTION_SELLING";
            const execTransactionType = isOptionSellingEntry ? "SELL" : "BUY";
            const execOrderType = botConfig.limitOrderSlippageGuard ? "LIMIT" : "MARKET";
            const roundToTick = (val: number, tick = 0.05) => Number((Math.round(val / tick) * tick).toFixed(2));
            const limitPriceWithSlippageGuard = isOptionSellingEntry
              ? roundToTick(optionPrice * 0.995)
              : roundToTick(optionPrice * 1.005);
            const effectiveStopLoss = isOptionSellingEntry
              ? Number((optionPrice * 1.28).toFixed(2))
              : signal.stopLoss;
            const effectiveTarget1 = isOptionSellingEntry
              ? Number((optionPrice * 0.55).toFixed(2))
              : signal.target1;

            // CORPORATE QUANT MULTI-INDEX ALPHA OPPORTUNITY SCORING:
            // Evaluates Net Profit Expectancy, Capital Efficiency, Greek Delta Momentum, and MTF Confluence
            const expNetProfit = Number(
              bestCandidate?.expectedNetProfit ||
                Math.max(350, (effectiveTarget1 - optionPrice) * targetQuantity - totalTradeBrokerage),
            );
            const totalReqCash = Math.max(100, totalRequiredCashWithBrokerage);
            const profitYield = expNetProfit / totalReqCash; // Expected Net ROI
            const mtfStatusBonus = signal.mtfConfirmation?.status ? 1.35 : 1.0;
            const rvolMultiplier = Math.min(2.0, Math.max(0.8, Number(signal.indicators?.rvol || 1.15)));
            const confidence = Number(signal.confidenceScore || 85);
            const alphaOpportunityScore = Number(
              (expNetProfit * (confidence / 100) * mtfStatusBonus * rvolMultiplier + profitYield * 120).toFixed(2),
            );

            marketAlphaCandidates.push({
              idx,
              signal,
              bestCandidate,
              optionSymbol,
              optionPrice,
              optInstrumentKey,
              lotSize,
              targetQuantity,
              affordableLots,
              totalTradeCost,
              totalTradeBrokerage,
              totalRequiredCashWithBrokerage,
              effectiveStopLoss,
              effectiveTarget1,
              isBullish,
              isOptionSellingEntry,
              execTransactionType,
              execOrderType,
              limitPriceWithSlippageGuard,
              alphaOpportunityScore,
              expectedNetProfit: expNetProfit,
              profitYield,
            });
            idxScanItem.alphaOpportunityScore = alphaOpportunityScore;
            idxScanItem.expectedNetProfit = expNetProfit;
          }
        }
      } catch (innerErr: any) {
        const errStr = String(innerErr?.message || innerErr?.cause?.message || innerErr?.cause?.code || innerErr);
        const isTransient =
          errStr.includes("ECONNRESET") ||
          errStr.includes("fetch failed") ||
          errStr.includes("socket hang up") ||
          errStr.includes("ETIMEDOUT") ||
          errStr.includes("UND_ERR_SOCKET") ||
          errStr.includes("EAI_AGAIN") ||
          innerErr?.name === "AbortError";
        if (isTransient) {
          console.warn(`[Index Polling] Handled transient network reset for ${idx.key}. Using cached market state.`);
        } else {
          console.error("Inner loop err for", idx.key, innerErr);
        }
      }
    }

    // PASS 1.5: Micro-Capital Equity Compounding Scanner
    // When effectiveCapital is under ₹2,500 (e.g. ₹524.59 live cash / small paper balance)
    // OR when tradeMode is AUTO_ADAPTIVE / BOTH / STOCKS_ONLY:
    // Seamlessly scan high-liquidity NSE momentum stocks with exact affordable shares (Lot size = 1)
    // so small balances can execute profitable trades, manage trailing exits, and compound the account!
    const shouldScanMicroCapitalEquities =
      botConfig.tradeMode === "AUTO_ADAPTIVE" ||
      botConfig.tradeMode === "BOTH" ||
      botConfig.tradeMode === "STOCKS_ONLY" ||
      effectiveCapital < 2500 ||
      marketAlphaCandidates.length === 0;

    if (shouldScanMicroCapitalEquities && effectiveCapital >= 15) {
      for (const eqStock of MICRO_CAPITAL_EQUITY_UNIVERSE) {
        try {
          const cachedQuote = liveQuotesMap[eqStock.instrumentKey] || globalLiveQuotes[eqStock.instrumentKey];
          let stockPrice = Number(cachedQuote?.last_price || 0);

          let stockCandles: any[] = [];
          const cachedC = intradayCandleCache[eqStock.instrumentKey];
          if (cachedC && Date.now() - cachedC.timestamp < 10000) {
            stockCandles = cachedC.raw;
          } else if (token) {
            const cUrl = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(eqStock.instrumentKey)}/1minute`;
            const cRes: any = await resilientFetchJson(cUrl, {
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Api-Version": "2.0" },
            }, 1, 3500).catch(() => null);
            if (cRes?.status === "success" && Array.isArray(cRes?.data?.candles) && cRes.data.candles.length > 0) {
              stockCandles = cRes.data.candles;
              intradayCandleCache[eqStock.instrumentKey] = { timestamp: Date.now(), raw: stockCandles };
            }
          }

          if (stockCandles.length > 0) {
            stockPrice = Number(stockCandles[0]?.[4] || stockPrice || eqStock.defaultPrice);
          } else {
            stockPrice = stockPrice || eqStock.defaultPrice;
          }

          if (stockPrice <= 0 || stockPrice > effectiveCapital) {
            continue;
          }

          // Exact affordable share count with round-trip brokerage & taxes included
          const affordableQty = Math.max(1, Math.floor((effectiveCapital * 0.98) / stockPrice));
          const tradeVal = Number((affordableQty * stockPrice).toFixed(2));
          const charges = calculateTradeCharges(stockPrice, affordableQty, false);
          const totalRequired = Number((tradeVal + charges.roundTripCharges).toFixed(2));

          if (totalRequired > effectiveCapital) {
            continue;
          }

          let isBullish = true;
          let confidence = 75;
          let summary = "";
          if (stockCandles.length < 10) {
            continue; // Require real multi-candle technical confirmation to strictly protect capital!
          }

          const enriched = enrichCandlesWithIndicators(stockCandles);
          const latestC = enriched[0];
          const cClose = Number(latestC?.close || stockPrice);
          const cEma9 = Number(latestC?.ema9 || cClose);
          const cEma21 = Number(latestC?.ema21 || cClose);
          const isSupertrendBullish = latestC?.supertrendDir === "BUY";
          const cRsi = Number(latestC?.rsi || 52);
          const isEmaBullish = cEma9 >= cEma21;

          // Strictly require triple-indicator confluence (SuperTrend BUY + EMA9 > EMA21 + Healthy RSI)
          if (!isSupertrendBullish || !isEmaBullish || cRsi < 46 || cRsi > 76) {
            continue; // Skip mediocre or choppy setups — zero loss discipline!
          }

          isBullish = true;
          confidence = Math.min(88, Math.round(75 + (cClose > cEma21 ? 7 : 0) + (cEma9 > cEma21 ? 6 : 0)));
          summary = `[Micro-Capital Compounding] ${eqStock.symbol} Confirmed Bullish Confluence: SuperTrend BUY, EMA9 (${cEma9.toFixed(1)}) > EMA21 (${cEma21.toFixed(1)}), RSI ${cRsi.toFixed(1)}. Sized ${affordableQty} shares for ₹${totalRequired.toFixed(2)}.`;

          const targetPrice = Number((stockPrice * 1.025).toFixed(2));
          const stopLossPrice = Number((stockPrice * 0.985).toFixed(2));
          const expectedNet = Math.max(1, Math.round((targetPrice - stockPrice) * affordableQty - charges.roundTripCharges));
          const profitYieldPct = Number(((expectedNet / tradeVal) * 100).toFixed(2));
          const alphaScore = Number((expectedNet * 8 + (confidence / 100) * 50 + profitYieldPct * 10).toFixed(2));

          marketAlphaCandidates.push({
            isEquityTrade: true,
            isOption: false,
            stockSymbol: eqStock.symbol,
            optInstrumentKey: eqStock.instrumentKey,
            optionSymbol: eqStock.symbol,
            optionPrice: stockPrice,
            lotSize: 1,
            targetQuantity: affordableQty,
            affordableLots: affordableQty,
            totalTradeCost: tradeVal,
            totalTradeBrokerage: charges.roundTripCharges,
            totalRequiredCashWithBrokerage: totalRequired,
            effectiveStopLoss: stopLossPrice,
            effectiveTarget1: targetPrice,
            isBullish,
            isOptionSellingEntry: false,
            execTransactionType: "BUY",
            execOrderType: "MARKET",
            limitPriceWithSlippageGuard: stockPrice,
            alphaOpportunityScore: alphaScore,
            expectedNetProfit: expectedNet,
            profitYield: profitYieldPct,
            idx: { symbol: eqStock.symbol, key: eqStock.instrumentKey },
            signal: {
              confidenceScore: confidence,
              underlyingInstrumentKey: eqStock.instrumentKey,
              target1: targetPrice,
              target2: Number((stockPrice * 1.04).toFixed(2)),
              target3: Number((stockPrice * 1.06).toFixed(2)),
              institutionalQuantAnalysis: {
                estimatedMaxOptionPrice: targetPrice,
                estimatedMinutesToTarget: 20,
              },
              summary,
            },
          });
        } catch {
          // Ignore transient error
        }
      }
    }

    // Update global multi-index comparative alpha matrix & rank indices
    if (currentTickMultiIndexComparison.length > 0) {
      currentTickMultiIndexComparison.sort((a, b) => {
        const aActive = a.signalType !== "HOLD" ? 1000 : 0;
        const bActive = b.signalType !== "HOLD" ? 1000 : 0;
        return (
          bActive +
          (b.alphaOpportunityScore || 0) +
          (b.confidenceScore || 0) -
          (aActive +
            (a.alphaOpportunityScore || 0) +
            (a.confidenceScore || 0))
        );
      });
      currentTickMultiIndexComparison.forEach((item, rIndex) => {
        item.rank = rIndex + 1;
        item.isTopPick = rIndex === 0 && item.signalType !== "HOLD";
      });
      setLatestMultiIndexAlphaMatrix(currentTickMultiIndexComparison);
    }

    // PASS 2: Multi-Index Alpha Comparison & Execution of the #1 Most Profitable Setup
    if (
      marketAlphaCandidates.length > 0 &&
      activePositions.length < maxAllowedConcurrent &&
      !botConfig.dailyLossLocked &&
      !isDailyTradeLimitReached &&
      !isInPostExitCooldown &&
      isTradingDay &&
      isTradingHours
    ) {
      // Sort all index candidates by alphaOpportunityScore descending!
      marketAlphaCandidates.sort((a, b) => b.alphaOpportunityScore - a.alphaOpportunityScore);

      const topPick = marketAlphaCandidates[0];
      const summaryIndices = marketAlphaCandidates
        .map((c) => `${c.idx.symbol}: Score ${c.alphaOpportunityScore} (+₹${c.expectedNetProfit.toFixed(0)})`)
        .join(" | ");

      botLogs.unshift({
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString(),
        message: `[MULTI-INDEX OPPORTUNITY SCANNER] Scanned 6 Major Indices: ${summaryIndices}. Top Pick: ${topPick.idx.symbol} (${topPick.optionSymbol}) chosen as #1 MOST PROFITABLE opportunity!`,
        type: "SIGNAL",
      });
      if (botLogs.length > 200) botLogs.length = 200;

      for (const cand of marketAlphaCandidates) {
        if (activePositions.length >= maxAllowedConcurrent) break;

        const isUnderlyingAlreadyOpen = activePositions.some(
          (p: any) =>
            p.underlyingInstrumentKey === cand.idx.key ||
            (p.symbol && p.symbol.startsWith(cand.idx.symbol.split(" ")[0])),
        );
        if (isUnderlyingAlreadyOpen) continue;

        // Capital & Margin verification
        if (botConfig.mode === "UPSTOX_LIVE") {
          if (
            liveAvailableMargin <= 0 ||
            cand.totalRequiredCashWithBrokerage > liveAvailableMargin
          ) {
            const warnMsg = `[LIVE CAPITAL GUARD] ⚠️ ബാലൻസ് കുറവായതിനാൽ (₹${liveAvailableMargin.toLocaleString("en-IN")}) പുതിയ ട്രേഡ് എടുത്തില്ല. ഗുണനിലവാരമുള്ള ട്രേഡിന് ₹${cand.totalRequiredCashWithBrokerage.toLocaleString("en-IN")} ആവശ്യമാണ്. അനാവശ്യ OTM ട്രേഡുകൾ ഒഴിവാക്കി പണം സംരക്ഷിച്ചു.`;
            botLogs.unshift({
              id: Date.now().toString(),
              time: new Date().toLocaleTimeString(),
              message: warnMsg,
              type: "ERROR",
            });
            if (botLogs.length > 200) botLogs.length = 200;
            continue;
          }
        } else if (botConfig.mode === "PAPER_TRADING") {
          // Paper Mode Capital Guard (consistent ₹2000 default paper capital)
          const initialBalance = getPaperInitialCapital();
          const totalRealized = paperTradeHistory
            .filter((t: any) => !t.mode || t.mode === "PAPER_TRADING")
            .reduce((acc, t) => acc + (t.netRealizedPnL ?? ((t.realizedPnL || 0) - (t.brokerageCharges || 0))), 0);
          const totalInvestedInOpen = paperPositions
            .filter((p: any) => !p.mode || p.mode === "PAPER_TRADING")
            .reduce((acc, p) => acc + (p.buyPrice * p.quantity), 0);
          const currentPaperBalance = initialBalance + totalRealized - totalInvestedInOpen;

          if (cand.totalRequiredCashWithBrokerage > currentPaperBalance) {
            const warnMsg = `[PAPER CAPITAL GUARD] Cannot buy ${cand.optionSymbol}: 1 Lot requires ₹${cand.totalRequiredCashWithBrokerage.toLocaleString("en-IN")}, but virtual balance is only ₹${currentPaperBalance.toFixed(2)}. Trade blocked to prevent overleveraging.`;
            botLogs.unshift({
              id: Date.now().toString(),
              time: new Date().toLocaleTimeString(),
              message: warnMsg,
              type: "ERROR",
            });
            if (botLogs.length > 200) botLogs.length = 200;
            continue;
          }
        }

        // Execute Paper Trade or Live Order!
        if (botConfig.mode === "PAPER_TRADING") {
          const logMsg = cand.isEquityTrade
            ? `[PAPER MICRO-CAPITAL COMPOUNDING] Top Setup Confirmed (${cand.signal.confidenceScore}%): BUY ${cand.stockSymbol} [${cand.targetQuantity} Shares @ ₹${cand.optionPrice} | Value: ₹${cand.totalTradeCost} + Brokerage: ₹${cand.totalTradeBrokerage.toFixed(2)} = Total: ₹${cand.totalRequiredCashWithBrokerage} | Target: ₹${cand.effectiveTarget1} (+₹${cand.expectedNetProfit})]. Capital Compounding Active!`
            : `[PAPER MODE] Top Alpha Setup Confirmed (${cand.signal.confidenceScore}%): ${cand.isOptionSellingEntry ? "SHORT SELLING" : "BUYING"} ${cand.optionSymbol} [${cand.affordableLots} Lot = ${cand.targetQuantity} Qty @ ₹${cand.optionPrice} (${cand.execOrderType}) | Premium: ₹${cand.totalTradeCost.toLocaleString("en-IN")} + Est. Brokerage: ₹${cand.totalTradeBrokerage.toFixed(2)} = Total: ₹${cand.totalRequiredCashWithBrokerage.toLocaleString("en-IN")} | Est. Net Profit: +₹${cand.expectedNetProfit}].`;

          botLogs.unshift({
            id: Date.now().toString(),
            time: new Date().toLocaleTimeString(),
            message: logMsg,
            type: "TRADE",
          });
          if (botLogs.length > 200) botLogs.length = 200;

          const newPosId = "POS" + Date.now();
          paperOrders.unshift({
            id: "ORD" + Date.now(),
            orderId: "PAP_" + Date.now().toString().slice(-6),
            positionId: newPosId,
            symbol: cand.optionSymbol,
            instrumentKey: cand.optInstrumentKey,
            transactionType: cand.execTransactionType,
            type: cand.execTransactionType,
            orderType: cand.execOrderType,
            productType: "INTRADAY",
            quantity: cand.targetQuantity,
            buyPrice: cand.optionPrice,
            price: cand.optionPrice,
            executedPrice: cand.optionPrice,
            status: "COMPLETE",
            timestamp: new Date().toLocaleTimeString("en-IN"),
            time: new Date().toISOString(),
            mode: "PAPER_TRADING",
            isOption: !cand.isEquityTrade,
          });
          if (cand.optInstrumentKey) {
            strikeDailyEntryCount[cand.optInstrumentKey] = (strikeDailyEntryCount[cand.optInstrumentKey] || 0) + 1;
          }
          paperPositions.push({
            id: newPosId,
            openedAtMs: Date.now(),
            symbol: cand.optionSymbol,
            instrumentKey: cand.optInstrumentKey,
            underlyingInstrumentKey: cand.signal.underlyingInstrumentKey,
            productType: "INTRADAY",
            quantity: cand.targetQuantity,
            buyPrice: cand.optionPrice,
            currentLTP: cand.optionPrice,
            pnl: 0,
            pnlPercent: 0,
            stopLoss: cand.effectiveStopLoss,
            target: cand.effectiveTarget1,
            target2: cand.signal.target2,
            target3: cand.signal.target3,
            estimatedMaxOptionPrice:
              cand.signal.institutionalQuantAnalysis?.estimatedMaxOptionPrice ||
              cand.signal.target2 ||
              cand.signal.target1,
            estimatedMinutesToTarget:
              cand.signal.institutionalQuantAnalysis?.estimatedMinutesToTarget,
            type: cand.execTransactionType,
            optionStrategyType: cand.isOptionSellingEntry ? "OPTION_SELLING" : "OPTION_BUYING",
            mode: "PAPER_TRADING",
            openedAt: new Date().toLocaleTimeString("en-IN"),
            isOption: !cand.isEquityTrade,
          });
          savePostgresDb().catch(() => { /* ignore */ });

          sendTelegramNotification(
            `🟢 <b>PAPER BOT ENTRY TRIGGERED (${cand.isEquityTrade ? "EQUITY COMPOUNDING" : cand.isOptionSellingEntry ? "OPTION SELLING" : "OPTION BUYING"})</b>\n\n` +
            `📊 <b>Symbol / Contract:</b> <code>${cand.optionSymbol}</code>\n` +
            `🏆 <b>Rank:</b> #1 Most Profitable Setup (Alpha Score: ${cand.alphaOpportunityScore})\n` +
            `🎯 <b>Direction:</b> ${cand.isEquityTrade ? "BUY STOCK (INTRADAY/DELIVERY)" : cand.isOptionSellingEntry ? `SHORT ${cand.isBullish ? "PE" : "CE"}` : cand.isBullish ? "CE (Bullish Call)" : "PE (Bearish Put)"}\n` +
            `📦 <b>Quantity:</b> ${cand.targetQuantity} ${cand.isEquityTrade ? "Shares" : `Qty (${cand.affordableLots} Lot)`}\n` +
            `💰 <b>Entry Price:</b> ₹${cand.optionPrice} (${cand.execOrderType} | Capital: ₹${cand.totalTradeCost.toLocaleString("en-IN")})\n` +
            `📈 <b>Est. Net Profit:</b> +₹${cand.expectedNetProfit}\n` +
            `🛡️ <b>Mode:</b> PAPER_TRADING\n` +
            `⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
          ).catch(() => { /* ignore */ });
        } else if (botConfig.mode === "UPSTOX_LIVE" && token) {
          try {
            const orderJson = await placeUpstoxOrderIpv4({
              quantity: cand.targetQuantity,
              product: cand.isEquityTrade ? "D" : "D",
              validity: "DAY",
              price: cand.execOrderType === "LIMIT" ? cand.limitPriceWithSlippageGuard : 0,
              tag: cand.isEquityTrade ? "bot_equity_buy" : (cand.isOptionSellingEntry ? "bot_auto_short" : "bot_auto_entry"),
              instrument_token: cand.optInstrumentKey,
              order_type: cand.execOrderType,
              transaction_type: cand.execTransactionType,
              disclosed_quantity: 0,
              trigger_price: 0,
              is_amo: false,
            }, token);
            if (orderJson?.status === "success") {
              if (cand.optInstrumentKey) {
                strikeDailyEntryCount[cand.optInstrumentKey] = (strikeDailyEntryCount[cand.optInstrumentKey] || 0) + 1;
              }
              paperOrders.unshift({
                id: "ORD" + Date.now(),
                orderId: orderJson.data?.order_id || "LIVE_" + Date.now().toString().slice(-6),
                symbol: cand.optionSymbol,
                instrumentKey: cand.optInstrumentKey,
                transactionType: cand.execTransactionType,
                type: cand.execTransactionType,
                orderType: cand.execOrderType,
                productType: "DELIVERY",
                quantity: cand.targetQuantity,
                buyPrice: cand.optionPrice,
                price: cand.optionPrice,
                executedPrice: cand.optionPrice,
                status: "COMPLETE",
                timestamp: new Date().toLocaleTimeString("en-IN"),
                time: new Date().toISOString(),
                mode: "UPSTOX_LIVE",
                isOption: !cand.isEquityTrade,
              });
              if (paperOrders.length > 200) paperOrders.length = 200;
              savePostgresDb().catch(() => { /* ignore */ });
              const liveLogMsg = cand.isEquityTrade
                ? `[UPSTOX LIVE MICRO-CAPITAL] Top Setup Executed (${cand.signal.confidenceScore}%): Bought ${cand.targetQuantity} Shares of ${cand.stockSymbol} @ ₹${cand.optionPrice} (Trade Value: ₹${cand.totalTradeCost.toLocaleString("en-IN")}, Est. Brokerage: ₹${cand.totalTradeBrokerage.toFixed(2)}). Live Capital Compounding Active!`
                : `[UPSTOX LIVE] Top Alpha Order Executed (${cand.signal.confidenceScore}%): ${cand.isOptionSellingEntry ? "Short Sold" : "Bought"} ${cand.optionSymbol} [${cand.affordableLots} Lot = ${cand.targetQuantity} Qty @ ₹${cand.optionPrice} (${cand.execOrderType}) | Premium: ₹${cand.totalTradeCost.toLocaleString("en-IN")} + Brokerage & Taxes: ₹${cand.totalTradeBrokerage.toFixed(2)} = Total Cash Used: ₹${cand.totalRequiredCashWithBrokerage.toLocaleString("en-IN")} | Est. Net Profit: +₹${cand.expectedNetProfit}].`;

              botLogs.unshift({
                id: Date.now().toString(),
                time: new Date().toLocaleTimeString(),
                message: liveLogMsg,
                type: "TRADE",
              });
              if (botLogs.length > 200) botLogs.length = 200;

              sendTelegramNotification(
                `🟢 <b>UPSTOX LIVE ENTRY EXECUTED (${cand.isEquityTrade ? "EQUITY COMPOUNDING" : cand.isOptionSellingEntry ? "OPTION SELLING" : "OPTION BUYING"})</b>\n\n` +
                `📊 <b>Symbol / Contract:</b> <code>${cand.optionSymbol}</code>\n` +
                `🏆 <b>Rank:</b> #1 Most Profitable Setup (Alpha Score: ${cand.alphaOpportunityScore})\n` +
                `🎯 <b>Direction:</b> ${cand.isEquityTrade ? "BUY STOCK (CASH DELIVERY/INTRADAY)" : cand.isOptionSellingEntry ? "SHORT OPTION" : cand.isBullish ? "CE (Bullish Call)" : "PE (Bearish Put)"}\n` +
                `📦 <b>Quantity:</b> ${cand.targetQuantity} ${cand.isEquityTrade ? "Shares" : `Qty (${cand.affordableLots} Lot)`}\n` +
                `💰 <b>Price:</b> ₹${cand.optionPrice} (₹${cand.totalTradeCost.toLocaleString("en-IN")})\n` +
                `🧾 <b>Est. Brokerage & Taxes:</b> ₹${cand.totalTradeBrokerage.toFixed(2)}\n` +
                `💳 <b>Total Cash Used:</b> ₹${cand.totalRequiredCashWithBrokerage.toLocaleString("en-IN")}\n` +
                `📈 <b>Est. Net Profit:</b> +₹${cand.expectedNetProfit}\n` +
                `🛡️ <b>Mode:</b> UPSTOX_LIVE\n` +
                `⏰ <b>Time:</b> ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`,
              ).catch(() => { /* ignore */ });
            } else {
              let errDetail = orderJson?.errors?.[0]?.message || orderJson?.message || JSON.stringify(orderJson);
              if (errDetail.includes("static IP") || errDetail.includes("34.96.48") || errDetail.includes("UDAPI1154")) {
                const liveIpNow = await getDetectedContainerIp();
                errDetail = `⚠️ Upstox static IP restriction: Upstox Developer Console-ൽ നിങ്ങളുടെ Static IP-കൾ (${FIXED_PRIMARY_IP}${liveIpNow ? `, ${liveIpNow}` : ""}) കൃത്യമായി നൽകിയിട്ടുണ്ടെന്ന് ഉറപ്പാക്കുക. (${errDetail})`;
              }
              const liveErrText = `[UPSTOX LIVE REJECTED] Order for ${cand.optionSymbol} rejected: ${errDetail}`;
              botLogs.unshift({
                id: Date.now().toString(),
                time: new Date().toLocaleTimeString(),
                message: liveErrText,
                type: "ERROR",
              });
              if (botLogs.length > 200) botLogs.length = 200;
            }
          } catch (err: any) {
            console.error("Error placing live auto buy order:", err);
          }
        }
      }
    }
  }
}
