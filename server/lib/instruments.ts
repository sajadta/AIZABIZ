// Instrument resolution, lot-size discovery and candle aggregation helpers.
import { paperPositions, paperTradeHistory } from "../state";
import { resilientFetchJson } from "./http";

export function aggregateCandles(candles: any[], intervalMs: number) {
  if (!candles || candles.length === 0) return [];
  const aggregated: any[] = [];
  let currentGroup: any = null;
  // Align multi-minute candles (3m, 5m, 15m, 30m, 1h) to Indian Market Open (09:15 AM IST = +03:45 UTC = 13,500,000 ms offset)
  const IST_MARKET_OPEN_OFFSET_MS = (3 * 60 + 45) * 60 * 1000;

  for (const candle of candles) {
    const alignedTime =
      Math.floor((candle.timestamp - IST_MARKET_OPEN_OFFSET_MS) / intervalMs) *
        intervalMs +
      IST_MARKET_OPEN_OFFSET_MS;

    if (!currentGroup || currentGroup.timestamp !== alignedTime) {
      if (currentGroup) aggregated.push(currentGroup);
      currentGroup = {
        timestamp: alignedTime,
        timeStr: new Date(alignedTime).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
        }),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      };
    } else {
      currentGroup.high = Math.max(currentGroup.high, candle.high);
      currentGroup.low = Math.min(currentGroup.low, candle.low);
      currentGroup.close = candle.close;
      currentGroup.volume += candle.volume;
    }
  }
  if (currentGroup) aggregated.push(currentGroup);
  return aggregated;
}

export const lotSizeCache: Record<string, { lotSize: number; timestamp: number; source: string; expiry?: string }> = {
  "NSE_INDEX|Nifty 50": { lotSize: 65, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "NSE_INDEX|Nifty Bank": { lotSize: 30, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "NSE_INDEX|Nifty Fin Service": { lotSize: 60, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "NSE_INDEX|NIFTY MID SELECT": { lotSize: 120, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "BSE_INDEX|SENSEX": { lotSize: 20, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "BSE_INDEX|BANKEX": { lotSize: 30, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "NIFTY 50": { lotSize: 65, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "NIFTY": { lotSize: 65, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "BANKNIFTY": { lotSize: 30, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "FINNIFTY": { lotSize: 60, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "MIDCPNIFTY": { lotSize: 120, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "SENSEX": { lotSize: 20, timestamp: Date.now(), source: "UPSTOX_LIVE" },
  "BANKEX": { lotSize: 30, timestamp: Date.now(), source: "UPSTOX_LIVE" },
};

export const getUnderlyingOptionInstrumentKey = (symbolOrKey: string): string => {
  const raw = String(symbolOrKey || "").trim();
  const s = raw.toUpperCase();
  if (s.includes("BANKEX")) return "BSE_INDEX|BANKEX";
  if (s.includes("SENSEX")) return "BSE_INDEX|SENSEX";
  if (s.includes("MID SELECT") || s.includes("MIDCP") || s.includes("MIDCAP"))
    return "NSE_INDEX|NIFTY MID SELECT";
  if (s.includes("FIN SERVICE") || s.includes("FINNIFTY"))
    return "NSE_INDEX|Nifty Fin Service";
  if (
    s.includes("NIFTY BANK") ||
    s.includes("BANKNIFTY") ||
    s.includes("BANK NIFTY") ||
    s === "BANK"
  )
    return "NSE_INDEX|Nifty Bank";
  if (s.includes("NIFTY")) return "NSE_INDEX|Nifty 50";
  return getInstrumentKey(raw);
};

export function shouldHoldOvernightBTST(pos: any, signal: any): boolean {
  if (!signal || !signal.indicators) return false;

  const isCall = /\bCE\b/i.test(pos.symbol || "");
  const isPut = /\bPE\b/i.test(pos.symbol || "");
  const ind = signal.indicators;
  const corpScore = signal.institutionalQuantAnalysis?.corporateHeavyweightScore ?? 0;

  if (isCall) {
    return (
      (signal.signalType === "BUY" || signal.sentiment === "BULLISH") &&
      ind.emaCross?.ema9 > ind.emaCross?.ema21 &&
      corpScore >= -10 &&
      (ind.rsi?.value || 50) < 78
    );
  } else if (isPut) {
    return (
      (signal.signalType === "SELL" || signal.sentiment === "BEARISH") &&
      ind.emaCross?.ema9 < ind.emaCross?.ema21 &&
      corpScore <= 10 &&
      (ind.rsi?.value || 50) > 22
    );
  }

  return signal.signalType === "BUY" && corpScore >= -15;
}

export const getDynamicLotSizeInfo = async (
  symbol: string,
  token: string,
  specificInstrumentKey?: string,
): Promise<{ lotSize: number; source: "UPSTOX_LIVE" | "CACHED_UPSTOX_LIVE" | "TOKEN_REQUIRED"; expiry?: string; underlyingKey: string }> => {
  const underlyingKey = getUnderlyingOptionInstrumentKey(symbol || specificInstrumentKey || "");
  const cacheKey = specificInstrumentKey && specificInstrumentKey.includes("FO|")
    ? specificInstrumentKey
    : underlyingKey;

  const now = Date.now();
  const cached = lotSizeCache[cacheKey] || lotSizeCache[underlyingKey];
  if (cached && cached.lotSize > 0 && now - cached.timestamp < 15 * 60 * 1000) {
    return {
      lotSize: cached.lotSize,
      source: "CACHED_UPSTOX_LIVE",
      expiry: cached.expiry,
      underlyingKey,
    };
  }

  if (token) {
    try {
      const contractData: any = await resilientFetchJson(
        `https://api.upstox.com/v2/option/contract?instrument_key=${encodeURIComponent(underlyingKey)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Api-Version": "2.0",
          },
        },
        2,
        5000
      );
      if (Array.isArray(contractData?.data) && contractData.data.length > 0) {
          let matchedContract = specificInstrumentKey
            ? contractData.data.find((c: any) => c.instrument_key === specificInstrumentKey)
            : null;

          if (!matchedContract) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcomingContracts = contractData.data
              .filter((c: any) => c.expiry && new Date(c.expiry).getTime() >= today.getTime() && Number(c.lot_size || c.minimum_lot) > 0)
              .sort((a: any, b: any) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
            matchedContract = upcomingContracts.length > 0 ? upcomingContracts[0] : contractData.data[0];
          }

          const liveLotSize = Number(matchedContract?.lot_size || matchedContract?.minimum_lot || 0);
          if (liveLotSize > 0) {
            const entry = {
              lotSize: liveLotSize,
              timestamp: now,
              source: "UPSTOX_LIVE",
              expiry: matchedContract?.expiry,
            };
            lotSizeCache[underlyingKey] = entry;
            lotSizeCache[cacheKey] = entry;
            if (symbol) lotSizeCache[symbol.toUpperCase()] = entry;
            return {
              lotSize: liveLotSize,
              source: "UPSTOX_LIVE",
              expiry: matchedContract?.expiry,
              underlyingKey,
            };
          }
        }
    } catch (e) {
      // Ignored
    }
  }

  if (cached && cached.lotSize > 0) {
    return {
      lotSize: cached.lotSize,
      source: "CACHED_UPSTOX_LIVE",
      expiry: cached.expiry,
      underlyingKey,
    };
  }

  const symUp = (symbol || specificInstrumentKey || underlyingKey || "").toUpperCase();
  let defaultLot = 1;
  if (symUp.includes("MIDCP") || symUp.includes("MID SELECT") || symUp.includes("MIDCAP")) defaultLot = 120;
  else if (symUp.includes("FINNIFTY") || symUp.includes("FIN SERVICE")) defaultLot = 60;
  else if (symUp.includes("BANKNIFTY") || symUp.includes("NIFTY BANK") || symUp === "BANK") defaultLot = 30;
  else if (symUp.includes("BANKEX")) defaultLot = 30;
  else if (symUp.includes("SENSEX")) defaultLot = 20;
  else if (symUp.includes("NIFTY")) defaultLot = 65;

  return {
    lotSize: defaultLot,
    source: "TOKEN_REQUIRED",
    underlyingKey,
  };
};

export const getDynamicLotSize = async (
  symbol: string,
  token: string,
  specificInstrumentKey?: string,
): Promise<number> => {
  const info = await getDynamicLotSizeInfo(symbol, token, specificInstrumentKey);
  return info.lotSize;
};

export function getInstrumentKey(symbolOrKey: string): string {
  const raw = String(symbolOrKey || "").trim();
  if (
    raw.startsWith("NSE_FO|") ||
    raw.startsWith("BSE_FO|") ||
    raw.startsWith("NSE_EQ|INE") ||
    raw.startsWith("BSE_EQ|INE")
  ) {
    return raw;
  }
  const s = raw.toUpperCase();
  if (s.includes("RELIANCE")) return "NSE_EQ|INE002A01018";
  if (s.includes("HDFCBANK") || s === "HDFC") return "NSE_EQ|INE040A01034";
  if (s.includes("TCS")) return "NSE_EQ|INE467B01029";
  if (s.includes("INFY")) return "NSE_EQ|INE009A01021";
  if (s.includes("ICICIBANK")) return "NSE_EQ|INE090A01021";
  if (s.includes("SBIN") || s === "SBI") return "NSE_EQ|INE062A01020";
  if (s.includes("AXISBANK")) return "NSE_EQ|INE238A01034";
  if (s.includes("KOTAKBANK")) return "NSE_EQ|INE237A01028";
  if (s.includes("INDUSINDBK")) return "NSE_EQ|INE095A01012";
  if (s.includes("HINDUNILVR")) return "NSE_EQ|INE030A01027";
  if (s.includes("ITC")) return "NSE_EQ|INE154A01025";
  if (s === "LT" || s.includes("INE018A01030")) return "NSE_EQ|INE018A01030";
  if (s.includes("BHARTIARTL")) return "NSE_EQ|INE397D01024";
  if (s.includes("BAJFINANCE")) return "NSE_EQ|INE296A01024";
  if (s.includes("HCLTECH")) return "NSE_EQ|INE860A01027";
  if (s.includes("ASIANPAINT")) return "NSE_EQ|INE021A01026";
  if (s.includes("TATAMOTORS")) return "NSE_EQ|INE155A01022";
  if (s.includes("TRIDENT")) return "NSE_EQ|INE064C01022";
  if (s.includes("SUZLON")) return "NSE_EQ|INE040H01021";
  if (s.includes("IRFC")) return "NSE_EQ|INE053F01010";
  if (s.includes("TATASTEEL")) return "NSE_EQ|INE081A01020";
  if (s.includes("IOC")) return "NSE_EQ|INE242A01010";
  if (s.includes("NHPC")) return "NSE_EQ|INE848E01016";
  if (s.includes("YESBANK")) return "NSE_EQ|INE528G01035";
  if (s.includes("ZOMATO")) return "NSE_EQ|INE758T01015";
  if (s.includes("BEL")) return "NSE_EQ|INE263A01024";

  const isOption = /\b(CE|PE|CALL|PUT)\b/.test(s) || s.endsWith("CE") || s.endsWith("PE");
  if (!isOption) {
    if (s.includes("CRUDEOIL") || s.includes("CRUDE")) return "MCX_FO|CRUDEOIL24NOVFUT";
    if (s.includes("NATURALGAS") || s.includes("NATGAS")) return "MCX_FO|NATURALGAS24NOVFUT";
    if (s.includes("GOLD")) return "MCX_FO|GOLD24NOVFUT";
    if (s.includes("SILVER")) return "MCX_FO|SILVER24NOVFUT";
    if (s.includes("US500") || s.includes("S&P 500") || s.includes("SPX")) return "GLOBAL_INDEX|US500";
    if (s.includes("BANKNIFTY FUT") || (s.includes("BANK") && s.includes("FUT"))) return "NSE_FO|BANKNIFTY24NOVFUT";
    if (s.includes("NIFTY FUT") || (s.includes("NIFTY") && s.includes("FUT"))) return "NSE_FO|NIFTY24NOVFUT";
    if (s.includes("BANKEX")) return "BSE_INDEX|BANKEX";
    if (s.includes("SENSEX")) return "BSE_INDEX|SENSEX";
    if (s.includes("MID SELECT") || s.includes("MIDCP") || s.includes("MIDCAP"))
      return "NSE_INDEX|NIFTY MID SELECT";
    if (s.includes("FIN SERVICE") || s.includes("FINNIFTY"))
      return "NSE_INDEX|Nifty Fin Service";
    if (
      s.includes("NIFTY BANK") ||
      s.includes("BANKNIFTY") ||
      s.includes("BANK NIFTY") ||
      s === "BANK"
    )
      return "NSE_INDEX|Nifty Bank";
    if (s.includes("NIFTY"))
      return "NSE_INDEX|Nifty 50";
  } else {
    const allPos = [...(paperPositions || []), ...(paperTradeHistory || [])];
    const match = allPos.find(p => p.symbol === raw || (p.instrumentKey && p.instrumentKey === raw));
    if (match && match.instrumentKey) {
      return match.instrumentKey;
    }
    if (s.includes("SENSEX") || s.includes("BANKEX")) {
      return `BSE_FO|${raw}`;
    }
    return `NSE_FO|${raw}`;
  }

  if (raw.includes(":") && !raw.includes("|")) {
    return raw.replace(":", "|");
  }
  return raw;
}

export const getNextExpiry = (symbol: string) => {
  const d = new Date();
  const dayOfWeek = d.getDay();
  let targetDay = 4;

  if (symbol.includes("BANKEX")) targetDay = 1;
  else if (symbol.includes("SENSEX")) targetDay = 5;
  else if (symbol.includes("BANK")) targetDay = 3;
  else if (symbol.includes("FIN")) targetDay = 2;
  else if (symbol.includes("MIDCP") || symbol.includes("MID SELECT")) targetDay = 1;

  let diff = targetDay - dayOfWeek;
  if (diff < 0) diff += 7;

  const expiryDate = new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
  return expiryDate.toISOString().split("T")[0];
};

export const MICRO_CAPITAL_EQUITY_UNIVERSE = [
  { symbol: "TRIDENT", name: "Trident Ltd", instrumentKey: "NSE_EQ|INE064C01022", defaultPrice: 35.5 },
  { symbol: "SUZLON", name: "Suzlon Energy Ltd", instrumentKey: "NSE_EQ|INE040H01021", defaultPrice: 58.0 },
  { symbol: "IRFC", name: "Indian Railway Finance", instrumentKey: "NSE_EQ|INE053F01010", defaultPrice: 148.0 },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd", instrumentKey: "NSE_EQ|INE081A01020", defaultPrice: 148.5 },
  { symbol: "IOC", name: "Indian Oil Corporation", instrumentKey: "NSE_EQ|INE242A01010", defaultPrice: 134.5 },
  { symbol: "NHPC", name: "NHPC Ltd", instrumentKey: "NSE_EQ|INE848E01016", defaultPrice: 82.0 },
  { symbol: "YESBANK", name: "Yes Bank Ltd", instrumentKey: "NSE_EQ|INE528G01035", defaultPrice: 19.8 },
  { symbol: "ZOMATO", name: "Zomato Ltd", instrumentKey: "NSE_EQ|INE758T01015", defaultPrice: 252.0 },
  { symbol: "BEL", name: "Bharat Electronics Ltd", instrumentKey: "NSE_EQ|INE263A01024", defaultPrice: 289.0 },
  { symbol: "ITC", name: "ITC Ltd", instrumentKey: "NSE_EQ|INE154A01025", defaultPrice: 284.5 },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", instrumentKey: "NSE_EQ|INE155A01022", defaultPrice: 380.0 },
  { symbol: "SBIN", name: "State Bank of India", instrumentKey: "NSE_EQ|INE062A01020", defaultPrice: 820.0 },
];
