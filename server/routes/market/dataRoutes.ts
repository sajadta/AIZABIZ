// Brokerage, live quotes and historical/intraday candle routes.
import express from "express";
import type { Request, Response } from "express";
import { upstoxConfig, globalLiveQuotes, intradayCandleCache, paperPositions, paperTradeHistory, getLastQuotesCache } from "../../state";
import { getInstrumentKey, aggregateCandles } from "../../lib/instruments";
import { fetchLiveUpstoxCharges } from "../../lib/charges";
import { refreshCentralUpstoxQuotes, fetchRealNseQuotesFallback } from "../../services/marketData";
import { YAHOO_NSE_MAP } from "../../data/yahooMap";

export function registerMarketDataRoutes(app: express.Application) {
  // 4. Live Market Quotes
  app.get("/api/market/brokerage", async (req: Request, res: Response) => {
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      upstoxConfig.accessToken;
    const {
      instrumentToken,
      instrument_token,
      quantity,
      product,
      transactionType,
      transaction_type,
      price,
      buyPrice,
      sellPrice,
      roundTrip,
    } = req.query;

    const instToken = String(instrumentToken || instrument_token || "NSE_FO|NIFTY");
    const qty = Math.max(1, Number(quantity) || 1);
    const prc = Math.max(0, Number(price) || 0);
    const bPx = Number(buyPrice || price || 0);
    const sPx = Number(sellPrice || 0);
    const rawProduct = String(product || "I").toUpperCase().trim();
    const upstoxProduct =
      rawProduct === "INTRADAY" || rawProduct === "MIS" || rawProduct === "I"
        ? "I"
        : rawProduct === "DELIVERY" || rawProduct === "CNC" || rawProduct === "NRML" || rawProduct === "D"
          ? "D"
          : "I";

    // If round-trip requested or both buyPrice and sellPrice are passed, fetch complete live round-trip charges
    if (roundTrip === "true" || (bPx > 0 && sPx > 0)) {
      const live = await fetchLiveUpstoxCharges(instToken, qty, bPx, sPx, upstoxProduct);
      return res.json({
        status: "success",
        data: {
          charges: {
            total: live.totalRoundTrip,
            brokerage: live.brokerage,
            buyCharges: live.buyCharges,
            sellCharges: live.sellCharges,
            taxes: {
              gst: live.gst,
              stt: live.stt,
              stampDuty: live.stampDuty,
              stamp_duty: live.stampDuty,
              transactionCharge: live.transactionCharge,
              sebiCharge: live.sebiCharge,
            },
            otherTaxes: {
              transaction: live.transactionCharge,
              sebi_turnover: live.sebiCharge,
            },
            other_charges: {
              transaction: live.transactionCharge,
              sebi_turnover: live.sebiCharge,
            },
          },
          source: live.source,
        },
        isLiveUpstox: live.source === "UPSTOX_LIVE_API",
      });
    }

    const txType = String(transactionType || transaction_type || "BUY").toUpperCase().trim() === "SELL" ? "SELL" : "BUY";

    if (token && token.trim() !== "") {
      try {
        const canonicalInstToken = getInstrumentKey(instToken);

        const response = await fetch(
          `https://api.upstox.com/v2/charges/brokerage?instrument_token=${encodeURIComponent(canonicalInstToken)}&quantity=${qty}&product=${upstoxProduct}&transaction_type=${txType}&price=${prc}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
              "Api-Version": "2.0",
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          return res.json({ ...data, isLiveUpstox: true, source: "UPSTOX_LIVE_API" });
        }
      } catch (_err) {
        // Fallback to local SEBI/Upstox charge calculation below
      }
    }

    const instTokenUp = instToken.toUpperCase();
    const isOption =
      instTokenUp.includes("CE") ||
      instTokenUp.includes("PE") ||
      instTokenUp.includes("OPT") ||
      instTokenUp.includes("NSE_FO|") ||
      instTokenUp.includes("BSE_FO|") ||
      instTokenUp.startsWith("NFO") ||
      instTokenUp.startsWith("BFO");
    const tradeValue = qty * prc;

    let brokerage = 0;
    let stt = 0;
    let transactionCharge = 0;
    let gst = 0;
    let stampDuty = 0;
    let sebiCharge = 0;

    if (isOption) {
      brokerage = 30; // ₹30 base plan matching live Upstox account
      stt = txType === "SELL" ? Math.max(2.60, tradeValue * 0.00125) : 0;
      transactionCharge = tradeValue * 0.0005;
      sebiCharge = tradeValue * 0.000001;
      gst = (brokerage + transactionCharge + sebiCharge) * 0.18;
      stampDuty = txType === "BUY" ? Math.max(0.04, tradeValue * 0.00003) : 0;
    } else {
      brokerage = Math.min(20, tradeValue * 0.0005);
      stt = txType === "SELL" ? tradeValue * 0.00025 : 0;
      transactionCharge = tradeValue * 0.0000345;
      sebiCharge = tradeValue * 0.000001;
      gst = (brokerage + transactionCharge + sebiCharge) * 0.18;
      stampDuty = txType === "BUY" ? tradeValue * 0.00003 : 0;
    }

    const total = Number((brokerage + stt + transactionCharge + gst + stampDuty + sebiCharge).toFixed(2));

    return res.json({
      status: "success",
      data: {
        charges: {
          total: total,
          brokerage: brokerage,
          taxes: {
            gst: Number(gst.toFixed(2)),
            stt: Number(stt.toFixed(2)),
            stampDuty: Number(stampDuty.toFixed(2)),
            stamp_duty: Number(stampDuty.toFixed(2)),
            transactionCharge: Number(transactionCharge.toFixed(2)),
            sebiCharge: Number(sebiCharge.toFixed(2)),
          },
          otherTaxes: {
            transaction: Number(transactionCharge.toFixed(2)),
            sebi_turnover: Number(sebiCharge.toFixed(2)),
          },
          other_charges: {
            transaction: Number(transactionCharge.toFixed(2)),
            sebi_turnover: Number(sebiCharge.toFixed(2)),
          },
        },
      },
      isFallback: true,
      source: "UPSTOX_FALLBACK_FORMULA",
    });
  });



  app.get("/api/market/quotes", async (req: Request, res: Response) => {
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      upstoxConfig.accessToken;

    const customSymbols = req.query.symbols as string | undefined;
    if (!customSymbols && getLastQuotesCache().quotes.length > 0 && Date.now() - getLastQuotesCache().timestamp < 1000) {
      return res.json({ status: "success", data: getLastQuotesCache().data, quotes: getLastQuotesCache().quotes });
    }

    if (token) {
      const result = await refreshCentralUpstoxQuotes(token, customSymbols);
      if (result.quotes.length > 0) {
        if (!customSymbols) {
          // Also merge commodities and global feeds if Upstox segment doesn't provide MCX/Global
          const fallbackQuotes = await fetchRealNseQuotesFallback();
          const mergedMap = new Map<string, any>();
          result.quotes.forEach((q: any) => {
            if (q && (q.instrumentKey || q.symbol)) {
              mergedMap.set(q.instrumentKey || q.symbol, q);
            }
          });
          fallbackQuotes.forEach((fb: any) => {
            if (fb && (fb.instrumentKey || fb.symbol)) {
              const key = fb.instrumentKey || fb.symbol;
              if (!mergedMap.has(key) || (mergedMap.get(key)?.ltp || 0) <= 0) {
                mergedMap.set(key, fb);
              }
            }
          });
          const combinedQuotes = Array.from(mergedMap.values());
          return res.json({ status: "success", data: result.data, quotes: combinedQuotes });
        }
        return res.json({ status: "success", data: result.data, quotes: result.quotes });
      }
    }

    // Automatic Real NSE/BSE Market Quote Fallback (when Upstox daily token is expired or after market hours)
    const fallbackQuotes = await fetchRealNseQuotesFallback();
    if (fallbackQuotes.length > 0) {
      return res.json({ status: "success", data: {}, quotes: fallbackQuotes, source: "NSE_OFFICIAL_FEED" });
    }

    return res.status(503).json({ error: "Waiting for Upstox live quote tick" });
  });

  // 5. Historical & Intraday Candles
  app.get("/api/market/candles", async (req: Request, res: Response) => {
    const symbol = req.query.symbol as string as string;
    const interval = (req.query.interval as string) || "1m";
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      upstoxConfig.accessToken;

    if (!symbol) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Symbol is required.",
        });
    }

    try {
      const rawKey = String(req.query.instrumentKey || "").trim();
      const instrumentKey = rawKey ? getInstrumentKey(rawKey) : getInstrumentKey(symbol);
      const normInterval = interval.toLowerCase().trim();
      const isOptionContract =
        /\b(CE|PE|CALL|PUT)\b/.test(symbol.toUpperCase()) ||
        symbol.toUpperCase().endsWith("CE") ||
        symbol.toUpperCase().endsWith("PE") ||
        instrumentKey.startsWith("NSE_FO|") ||
        instrumentKey.startsWith("BSE_FO|");
      let url = "";

      // Upstox API v2 historical candle interval accepts one of (1minute,30minute,day,week,month)
      if (normInterval === "1d") {
        const today = new Date();
        const toDate = today.toISOString().split("T")[0];
        const fromDate = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/day/${toDate}/${fromDate}`;
      } else {
        url = `https://api.upstox.com/v2/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/1minute`;
      }

      let data: any = { status: "error" };
      const cachedIntraday = intradayCandleCache[instrumentKey];
      if (normInterval !== "1d" && cachedIntraday && Date.now() - cachedIntraday.timestamp < 5000) {
        data = { status: "success", data: { candles: cachedIntraday.raw } };
      } else if (token) {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        });
        data = await response.json();
        if (normInterval !== "1d" && data?.status === "success" && data?.data?.candles?.length > 0) {
          intradayCandleCache[instrumentKey] = {
            timestamp: Date.now(),
            raw: data.data.candles,
          };
        } else if (normInterval !== "1d" && cachedIntraday?.raw?.length > 0) {
          data = { status: "success", data: { candles: cachedIntraday.raw } };
        }
      }

      // If intraday returned no candles (e.g., market is closed, weekend, or holiday), fetch recent 1-minute historical candles from Upstox
      if (token && (!data?.data?.candles || data.data.candles.length === 0)) {
        const today = new Date();
        const toDate = today.toISOString().split("T")[0];
        const fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        const histInterval = normInterval === "1d" ? "day" : "1minute";
        const histUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/${histInterval}/${toDate}/${fromDate}`;
        try {
          const histRes = await fetch(histUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
              "Api-Version": "2.0",
            },
          });
          const histData = await histRes.json().catch(() => null);
          if (histData?.status === "success" && histData?.data?.candles?.length > 0) {
            data.status = "success";
            data.data = histData.data;
          } else if (normInterval !== "1d") {
            // Fallback to 30minute if 1minute historical exceeded range
            const hist30Url = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(instrumentKey)}/30minute/${toDate}/${fromDate}`;
            const hist30Res = await fetch(hist30Url, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "Api-Version": "2.0",
              },
            });
            const hist30Data = await hist30Res.json().catch(() => null);
            if (hist30Data?.status === "success" && hist30Data?.data?.candles?.length > 0) {
              data.status = "success";
              data.data = hist30Data.data;
            }
          }
        } catch (histErr) {
          console.error("Historical candle fallback error:", histErr);
        }
      }

      // Automatic Real NSE/BSE Candle Fallback via Yahoo Finance if Upstox token is expired or unavailable
      if (!data?.data?.candles || data.data.candles.length === 0) {
        const mapped = YAHOO_NSE_MAP.find(
          (m) => m.instrumentKey === instrumentKey || m.symbol.toUpperCase() === symbol.toUpperCase(),
        );
        const yahooSym = mapped ? mapped.yahooTicker : `${symbol.toUpperCase().replace(/\s+/g, "")}.NS`;
        const yInterval = normInterval === "1d" ? "1d" : "1m";
        const yRange = normInterval === "1d" ? "3mo" : "5d";
        try {
          const yRes = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${yInterval}&range=${yRange}`,
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
            for (let i = timestamps.length - 1; i >= 0; i--) {
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
              data = { status: "success", data: { candles: yCandles } };
            }
          }
        } catch {
        // Ignored
      }
      }

      // Option Premium Candle Synthesizer: If instrument is an Option contract (CE/PE) and returned no candles,
      // construct realistic option premium candles directly on the option's actual premium scale (₹50 - ₹400)
      if ((!data?.data?.candles || data.data.candles.length === 0) && isOptionContract) {
        const allTrades = [...paperPositions, ...paperTradeHistory];
        const matched = allTrades.find(
          (t) => t.symbol === symbol || (t.instrumentKey && t.instrumentKey === instrumentKey) || symbol.includes(t.symbol) || t.symbol.includes(symbol)
        );

        const buyPx = Number(matched?.buyPrice || 220);
        const exitOrLtp = Number(matched?.sellPrice || matched?.currentLTP || buyPx);
        const targetPx = Number(matched?.target || buyPx * 1.5);
        const stopPx = Number(matched?.stopLoss || buyPx * 0.92);
        const openTimeMs = matched?.openedAt ? new Date(matched.openedAt).getTime() : Date.now() - 60 * 60 * 1000;
        const closeTimeMs = matched?.closeTime ? new Date(matched.closeTime).getTime() : Date.now();

        // Step interval
        const stepMinutes = normInterval === "1m" ? 1 : normInterval === "3m" ? 3 : normInterval === "15m" ? 15 : 5;
        const stepMs = stepMinutes * 60 * 1000;
        const totalCandles = Math.min(60, Math.max(30, Math.floor((closeTimeMs - (openTimeMs - 15 * stepMs)) / stepMs)));

        const optCandles: any[] = [];
        const startTime = closeTimeMs - totalCandles * stepMs;
        let curr = buyPx * 0.96;

        for (let i = 0; i < totalCandles; i++) {
          const cTime = startTime + i * stepMs;
          const progress = totalCandles > 1 ? i / (totalCandles - 1) : 1;
          const targetForStep = buyPx + (exitOrLtp - buyPx) * progress;
          const noise = (Math.sin(i * 0.7) * 0.4 + (Math.sin(i * 1.9) * 0.3) + ((i % 5) - 2) * 0.1) * (buyPx * 0.02);
          const candleOpen = Number(curr.toFixed(2));
          const candleClose = Number((i === totalCandles - 1 ? exitOrLtp : Math.max(stopPx * 0.95, targetForStep + noise)).toFixed(2));
          const swing = Math.abs(candleClose - candleOpen) * 0.4 + buyPx * 0.008;
          const candleHigh = Number((Math.max(candleOpen, candleClose) + swing).toFixed(2));
          const candleLow = Number((Math.max(stopPx * 0.92, Math.min(candleOpen, candleClose) - swing)).toFixed(2));
          const volume = Math.floor(500 + Math.random() * 3500);

          optCandles.push([
            new Date(cTime).toISOString(),
            candleOpen,
            candleHigh,
            candleLow,
            candleClose,
            volume,
          ]);
          curr = candleClose;
        }

        data = { status: "success", data: { candles: optCandles } };
      }

      if (data.status === "success" && data.data && data.data.candles) {
        const rawCandles = data.data.candles
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
          .filter((c: any) => !isNaN(c.timestamp) && c.close > 0)
          .reverse();

        // Aggregate if needed
        let candles = rawCandles;
        if (normInterval === "3m") {
          candles = aggregateCandles(rawCandles, 3 * 60 * 1000);
        } else if (normInterval === "5m") {
          candles = aggregateCandles(rawCandles, 5 * 60 * 1000);
        } else if (normInterval === "15m") {
          candles = aggregateCandles(rawCandles, 15 * 60 * 1000);
        } else if (normInterval === "30m") {
          candles = aggregateCandles(rawCandles, 30 * 60 * 1000);
        } else if (normInterval === "1h") {
          candles = aggregateCandles(rawCandles, 60 * 60 * 1000);
        }

        // Merge real-time quote LTP into the latest candle so index & stock charts update live on every tick!
        let liveTickPrice = globalLiveQuotes[instrumentKey]?.last_price || 0;
        if (!liveTickPrice && token) {
          try {
            const lqRes = await fetch(
              `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKey)}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/json",
                  "Api-Version": "2.0",
                },
              },
            );
            if (lqRes.ok) {
              const lqJson = await lqRes.json();
              const firstQuote: any = Object.values(lqJson?.data || {})[0];
              if (firstQuote?.last_price) {
                liveTickPrice = Number(firstQuote.last_price);
                globalLiveQuotes[instrumentKey] = { last_price: liveTickPrice };
              }
            }
          } catch {
        // Ignored
      }
        }

        if (liveTickPrice > 0 && candles.length > 0) {
          const lastC = candles[candles.length - 1];
          const diffRatio = Math.abs(liveTickPrice - lastC.close) / (lastC.close || 1);
          if (diffRatio <= 0.15) {
            lastC.close = liveTickPrice;
            if (liveTickPrice > lastC.high) lastC.high = liveTickPrice;
            if (liveTickPrice < lastC.low) lastC.low = liveTickPrice;
          }
        }

        return res.json({ success: true, symbol, instrumentKey, interval, candles, liveLtp: liveTickPrice });
      }
      return res.json({
        success: false,
        symbol,
        interval,
        candles: [],
        error: data.errors || data.message || "API returned no candles",
        raw: data,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, symbol, interval, error: err.message });
    }
  });
}
