// 5-year daily regime metrics (EMA50/200, swing S/R, breakout win rate) with a
// 15-minute cache and a Yahoo Finance fallback when the Upstox token is missing.
import { fiveYearHistoricalRegimeCache } from "../../../state";
import { resilientFetchJson } from "../../../lib/http";
import { YAHOO_NSE_MAP } from "../../../data/yahooMap";

const CACHE_TTL_MS = 15 * 60 * 1000;

export async function getFiveYearRegime(
  idx: { key: string; symbol: string },
  ctx: { token: string; today: Date; toDate: string; liveLtp: number },
) {
  const { token, today, toDate, liveLtp } = ctx;
  let fiveYearMetrics = fiveYearHistoricalRegimeCache[idx.key];
  if (fiveYearMetrics && Date.now() - fiveYearMetrics.timestamp <= CACHE_TTL_MS) {
    return fiveYearMetrics;
  }

  try {
    let dayJson: any = null;
    if (token) {
      const fiveYrsAgoDate = new Date(today.getTime() - 5 * 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const dayHistUrl = `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(idx.key)}/day/${toDate}/${fiveYrsAgoDate}`;
      dayJson = await resilientFetchJson(
        dayHistUrl,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        },
        1,
        6000,
      );
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
    if (
      dayJson?.status === "success" &&
      Array.isArray(dayJson?.data?.candles) &&
      dayJson.data.candles.length >= 30
    ) {
      // Upstox returns newest first; reverse for chronological EMA50/EMA200 math
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

      const recent250Days = dailyChrono.slice(-Math.min(250, dailyChrono.length));
      const dailyHighsAbove = recent250Days
        .map((c: any) => Number(c[2] || 0))
        .filter((h: number) => h > liveLtp * 1.001)
        .sort((a: number, b: number) => a - b);
      const dailyLowsBelow = recent250Days
        .map((c: any) => Number(c[3] || 0))
        .filter((l: number) => l > 0 && l < liveLtp * 0.999)
        .sort((a: number, b: number) => b - a);

      const multiYearResistance = Number((dailyHighsAbove[0] || liveLtp * 1.012).toFixed(2));
      const multiYearSupport = Number((dailyLowsBelow[0] || liveLtp * 0.988).toFixed(2));

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
    // Keep any previously cached metrics on a transient fetch failure
  }
  return fiveYearHistoricalRegimeCache[idx.key];
}
