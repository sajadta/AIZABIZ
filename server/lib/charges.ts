// Live brokerage/charges lookup with Upstox API and a local fallback formula.
import { upstoxConfig } from "../state";
import { calculateTradeCharges } from "../../src/utils/indicators";
import { resilientFetchJson } from "./http";
import { getInstrumentKey } from "./instruments";

export interface LiveUpstoxChargesBreakdown {
  totalRoundTrip: number;
  buyCharges: number;
  sellCharges: number;
  brokerage: number;
  stt: number;
  gst: number;
  stampDuty: number;
  transactionCharge: number;
  sebiCharge: number;
  source: "UPSTOX_LIVE_API" | "UPSTOX_FALLBACK_FORMULA";
}

const liveUpstoxChargesCache: Record<string, { timestamp: number; data: LiveUpstoxChargesBreakdown }> = {};

export async function fetchLiveUpstoxCharges(
  instrumentToken: string,
  quantity: number,
  buyPrice: number,
  sellPrice?: number,
  productType: string = "D",
): Promise<LiveUpstoxChargesBreakdown> {
  const qty = Math.max(1, Number(quantity) || 1);
  const buyPx = Math.max(0.05, Number(buyPrice) || 0);
  const sellPx = sellPrice !== undefined && Number(sellPrice) > 0 ? Number(sellPrice) : Number((buyPx * 1.25).toFixed(2));
  const rawProduct = String(productType || "D").toUpperCase().trim();
  const upstoxProduct =
    rawProduct === "INTRADAY" || rawProduct === "MIS" || rawProduct === "I"
      ? "I"
      : "D";
  const canonicalToken = getInstrumentKey(instrumentToken || "NSE_FO|NIFTY");

  const cacheKey = `${canonicalToken}_${qty}_${buyPx.toFixed(2)}_${sellPx.toFixed(2)}_${upstoxProduct}`;
  const cached = liveUpstoxChargesCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data;
  }

  const token = upstoxConfig.accessToken;
  if (token && token.trim() !== "") {
    try {
      const [resBuy, resSell] = await Promise.all([
        resilientFetchJson<any>(
          `https://api.upstox.com/v2/charges/brokerage?instrument_token=${encodeURIComponent(canonicalToken)}&quantity=${qty}&product=${upstoxProduct}&transaction_type=BUY&price=${buyPx}`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
              "Api-Version": "2.0",
            },
          },
          1,
          3500
        ),
        resilientFetchJson<any>(
          `https://api.upstox.com/v2/charges/brokerage?instrument_token=${encodeURIComponent(canonicalToken)}&quantity=${qty}&product=${upstoxProduct}&transaction_type=SELL&price=${sellPx}`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
              "Api-Version": "2.0",
            },
          },
          1,
          3500
        ),
      ]);

      const buyCharges = Number(resBuy?.data?.charges?.total || 0);
      const sellCharges = Number(resSell?.data?.charges?.total || 0);

      if ((buyCharges > 0 || sellCharges > 0) && resBuy?.status === "success") {
        const buyBrok = Number(resBuy?.data?.charges?.brokerage || 30);
        const sellBrok = Number(resSell?.data?.charges?.brokerage || 30);
        const buyGst = Number(resBuy?.data?.charges?.taxes?.gst || 0);
        const sellGst = Number(resSell?.data?.charges?.taxes?.gst || 0);
        const buyStt = Number(resBuy?.data?.charges?.taxes?.stt || 0);
        const sellStt = Number(resSell?.data?.charges?.taxes?.stt || 0);
        const buyStamp = Number(resBuy?.data?.charges?.taxes?.stamp_duty || resBuy?.data?.charges?.taxes?.stampDuty || 0);
        const sellStamp = Number(resSell?.data?.charges?.taxes?.stamp_duty || resSell?.data?.charges?.taxes?.stampDuty || 0);
        const buyTxn = Number(resBuy?.data?.charges?.other_charges?.transaction || resBuy?.data?.charges?.otherTaxes?.transaction || 0);
        const sellTxn = Number(resSell?.data?.charges?.other_charges?.transaction || resSell?.data?.charges?.otherTaxes?.transaction || 0);
        const buySebi = Number(resBuy?.data?.charges?.other_charges?.sebi_turnover || resBuy?.data?.charges?.otherTaxes?.sebi_turnover || 0);
        const sellSebi = Number(resSell?.data?.charges?.other_charges?.sebi_turnover || resSell?.data?.charges?.otherTaxes?.sebi_turnover || 0);

        const totalRoundTrip = Number((buyCharges + sellCharges).toFixed(2));
        const result: LiveUpstoxChargesBreakdown = {
          totalRoundTrip,
          buyCharges: Number(buyCharges.toFixed(2)),
          sellCharges: Number(sellCharges.toFixed(2)),
          brokerage: Number((buyBrok + sellBrok).toFixed(2)),
          stt: Number((buyStt + sellStt).toFixed(2)),
          gst: Number((buyGst + sellGst).toFixed(2)),
          stampDuty: Number((buyStamp + sellStamp).toFixed(2)),
          transactionCharge: Number((buyTxn + sellTxn).toFixed(2)),
          sebiCharge: Number((buySebi + sellSebi).toFixed(2)),
          source: "UPSTOX_LIVE_API",
        };
        liveUpstoxChargesCache[cacheKey] = { timestamp: Date.now(), data: result };
        return result;
      }
    } catch {
      // Ignored
    }
  }

  const fallback = calculateTradeCharges(buyPx, qty, true, sellPx);
  const result: LiveUpstoxChargesBreakdown = {
    totalRoundTrip: fallback.roundTripCharges,
    buyCharges: fallback.buyCharges,
    sellCharges: fallback.sellCharges,
    brokerage: fallback.buyBrokerage + fallback.sellBrokerage,
    stt: fallback.stt,
    gst: fallback.gst,
    stampDuty: fallback.stampDuty,
    transactionCharge: fallback.exchangeTxnCharge,
    sebiCharge: fallback.sebiCharge,
    source: "UPSTOX_FALLBACK_FORMULA",
  };
  liveUpstoxChargesCache[cacheKey] = { timestamp: Date.now(), data: result };
  return result;
}
