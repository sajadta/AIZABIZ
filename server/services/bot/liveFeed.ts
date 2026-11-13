// Bot tick live-feed phase: resolves active positions, refreshes live quotes/LTP
// and computes the IST clock + EOD square-off flag used by the rest of the tick.
import { botConfig, upstoxConfig, botSignals, paperPositions, globalLiveQuotes, livePositionStateTracker, lastQuotesCache, getCachedUpstoxLivePositions, setCachedUpstoxLivePositions } from "../../state";
import { resilientFetchJson } from "../../lib/http";

export interface BotTickContext {
  token: string;
  activePositions: any[];
  liveQuotesMap: any;
  nowIst: Date;
  isEodSquareOff: boolean;
}

export async function prepareTickContext(): Promise<BotTickContext | null> {
  let activePositions: any[] =
    botConfig.mode === "PAPER_TRADING" ? [...paperPositions] : [];

  // Fetch live positions if in UPSTOX_LIVE mode (cached for 2s so 1s loop never triggers 429)
  if (botConfig.mode === "UPSTOX_LIVE" && upstoxConfig.accessToken) {
    try {
      if (Date.now() - getCachedUpstoxLivePositions().timestamp < 3500) {
        activePositions = getCachedUpstoxLivePositions().list;
      } else {
        getCachedUpstoxLivePositions().timestamp = Date.now();
        const pData: any = await resilientFetchJson(
          "https://api.upstox.com/v2/portfolio/short-term-positions",
          {
            headers: {
              Authorization: `Bearer ${upstoxConfig.accessToken}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          },
          1,
          4000
        );
        if (pData?.status === "success" && pData?.data) {
          activePositions = pData.data
            .map((p: any) => {
              const pKey = p.instrument_token || p.trading_symbol;
              const buyPx = Number(
                p.day_buy_price ||
                p.buy_price ||
                p.average_price ||
                (p.day_buy_value && p.day_buy_quantity ? p.day_buy_value / p.day_buy_quantity : 0) ||
                (p.buy_value && p.buy_quantity ? p.buy_value / p.buy_quantity : 0) ||
                0
              );
              const curLtp = Number(p.last_price || buyPx);
              if (!livePositionStateTracker[pKey]) {
                livePositionStateTracker[pKey] = {
                  openedAtMs: Date.now(),
                  highestLTP: Math.max(buyPx, curLtp),
                  highestPnl: 0,
                  highestNetPnl: 0,
                };
              }
              const tracker = livePositionStateTracker[pKey];
              tracker.highestLTP = Math.max(tracker.highestLTP, buyPx, curLtp);
              return {
                id: p.trading_symbol || p.instrument_token,
                symbol: p.trading_symbol || p.instrument_token,
                instrumentKey: p.instrument_token,
                product: p.product || "D",
                productType: p.product === "I" ? "INTRADAY" : "DELIVERY",
                type: p.quantity > 0 ? "BUY" : p.quantity < 0 ? "SELL" : "CLOSED",
                quantity: Math.abs(p.quantity || p.net_quantity || 0),
                buyPrice: buyPx,
                currentLTP: curLtp,
                openedAtMs: tracker.openedAtMs,
                highestLTP: tracker.highestLTP,
                highestPnl: tracker.highestPnl,
                highestNetPnl: tracker.highestNetPnl,
                lockedStopLossPrice: tracker.lockedStopLossPrice,
                brokerageCharges: tracker.brokerageCharges,
                brokerageSource: tracker.brokerageSource,
                pnl: p.pnl || p.m2m,
                mode: "UPSTOX_LIVE",
                isOption:
                  /\b(CE|PE)\b/i.test(p.trading_symbol || "") ||
                  String(p.instrument_token || "").includes("FO"),
              };
            })
            .filter((p: any) => p.type !== "CLOSED" && p.quantity > 0);
          setCachedUpstoxLivePositions({ timestamp: Date.now(), list: activePositions });
        } else {
          getCachedUpstoxLivePositions().timestamp = Date.now();
        }
      }
    } catch (err) {
      getCachedUpstoxLivePositions().timestamp = Date.now();
      console.error("Error fetching live positions for bot:", err);
    }
  }

  let currentLiveQuote = 24200; // Fallback

  // Fetch live quotes to update PNL + Corporate Heavyweights + Active Option Positions on EVERY 1-SECOND tick!
  const token = upstoxConfig.accessToken;
  if (!token && botConfig.mode === "UPSTOX_LIVE") {
    botSignals.length = 0;
    return null;
  }
  let instruments = [
    (botConfig as any).selectedInstrumentKey || "NSE_INDEX|Nifty 50",
    "NSE_INDEX|Nifty 50",
    "NSE_INDEX|Nifty Bank",
    "BSE_INDEX|SENSEX",
    "NSE_INDEX|Nifty Fin Service",
    "NSE_INDEX|NIFTY MID SELECT",
    "BSE_INDEX|BANKEX",
    "MCX_FO|CRUDEOIL24NOVFUT",
    "MCX_FO|NATURALGAS24NOVFUT",
    "MCX_FO|GOLD24NOVFUT",
    "MCX_FO|SILVER24NOVFUT",
    "NSE_FO|NIFTY24NOVFUT",
    "NSE_FO|BANKNIFTY24NOVFUT",
    "GLOBAL_INDEX|US500",
    "GLOBAL_INDEX|NDX",
    "NSE_EQ|INE040A01034", // HDFCBANK
    "NSE_EQ|INE002A01018", // RELIANCE
    "NSE_EQ|INE090A01021", // ICICIBANK
    "NSE_EQ|INE009A01021", // INFY
    "NSE_EQ|INE467B01029", // TCS
    "NSE_EQ|INE154A01025", // ITC
    "NSE_EQ|INE018A01030", // LT
    "NSE_EQ|INE062A01020", // SBIN
    "NSE_EQ|INE238A01034", // AXISBANK
    "NSE_EQ|INE237A01028", // KOTAKBANK
    "NSE_EQ|INE095A01012", // INDUSINDBK
  ];
  activePositions.forEach((p) => {
    if (p.instrumentKey && !instruments.includes(p.instrumentKey)) {
      instruments.push(p.instrumentKey);
    }
  });
  instruments = Array.from(new Set(instruments));

  let liveQuotesMap: any = { ...(lastQuotesCache.data || {}) };
  // Avoid UDAPI10005 Rate-Limit on heavy /v2/market-quote/quotes (15+ symbols): refresh full batch every 1200ms
  const quoteRefreshThresholdMs = 1200;
  if (
    token &&
    (Object.keys(liveQuotesMap).length === 0 ||
      Date.now() - (lastQuotesCache.timestamp || 0) >= quoteRefreshThresholdMs)
  ) {
    try {
      const qData: any = await resilientFetchJson(
        `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instruments.join(","))}`,
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
      if (qData?.data) {
        liveQuotesMap = { ...liveQuotesMap, ...qData.data };
        lastQuotesCache.timestamp = Date.now();
        lastQuotesCache.data = liveQuotesMap;
        for (const [k, v] of Object.entries(qData.data)) {
          globalLiveQuotes[k] = v;
          const tok = (v as any)?.instrument_token;
          if (tok) {
            globalLiveQuotes[tok] = v;
            liveQuotesMap[tok] = v;
          }
        }
      }
    } catch (e) {
    // Ignored
  }
  }

  // Dedicated Ultra-Fast Lightweight LTP Poll (/v2/market-quote/ltp) specifically for Active Option Positions!
  // Never suffers from UDAPI10005 rate limit and guarantees pos.currentLTP updates in real time!
  if (token && activePositions.length > 0) {
    const activeKeys = Array.from(
      new Set(activePositions.map((p) => p.instrumentKey).filter(Boolean)),
    );
    if (activeKeys.length > 0) {
      try {
        const ltpJson: any = await resilientFetchJson(
          `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(activeKeys.join(","))}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          },
          1,
          3000
        );
        if (ltpJson?.status === "success" && ltpJson?.data) {
          for (const [k, v] of Object.entries(ltpJson.data)) {
            const item = v as any;
            if (item && Number(item.last_price) > 0) {
              liveQuotesMap[k] = { ...(liveQuotesMap[k] || {}), ...item };
              globalLiveQuotes[k] = liveQuotesMap[k];
              if (item.instrument_token) {
                liveQuotesMap[item.instrument_token] = {
                  ...(liveQuotesMap[item.instrument_token] || {}),
                  ...item,
                };
                globalLiveQuotes[item.instrument_token] =
                  liveQuotesMap[item.instrument_token];
              }
            }
          }
        }
      } catch {
    // Ignored
  }
    }
  }

  const mainKey =
    (botConfig as any).selectedInstrumentKey || "NSE_INDEX|Nifty 50";
  const mq =
    liveQuotesMap[mainKey] ||
    Object.values(liveQuotesMap).find(
      (q: any) => q && q.instrument_token === mainKey,
    );
  if (mq?.last_price) {
    currentLiveQuote = mq.last_price;
  }

  // Merge with global WS quotes
  for (const k in globalLiveQuotes) {
    if (!liveQuotesMap[k]) liveQuotesMap[k] = globalLiveQuotes[k];
  }

  // Sanitize paperPositions: remove any corrupted position that accidentally got an INDEX key or dummy ₹100 price
  paperPositions.splice(0, paperPositions.length, ...paperPositions.filter(
    (p) =>
      p &&
      p.instrumentKey &&
      !String(p.instrumentKey).includes("INDEX") &&
      !(p.buyPrice === 100 && p.currentLTP === 100),
  ));

  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  // Only trigger EOD square off between 15:25 and 15:30 to prevent API spam after market hours
  const isEodSquareOff =
    nowIst.getHours() === 15 &&
    nowIst.getMinutes() >= 25 &&
    nowIst.getMinutes() < 30;

  return { token, activePositions, liveQuotesMap, nowIst, isEodSquareOff };
}
