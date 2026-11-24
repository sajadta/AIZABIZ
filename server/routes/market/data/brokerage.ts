// Live brokerage/charges estimate route.
import type { Request, Response } from "express";
import { upstoxConfig } from "../../../state";
import { getInstrumentKey } from "../../../lib/instruments";
import { fetchLiveUpstoxCharges } from "../../../lib/charges";

export function registerBrokerageRoutes(app: any) {
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
}
