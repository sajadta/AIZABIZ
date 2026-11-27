// Round-trip brokerage/tax estimates for a position: instant local math plus a
// live Upstox quote refresh when the server has it cached.
import { useEffect, useMemo, useState } from 'react';
import type { Position } from '../../types';
import { calculateTradeCharges } from '../../utils/indicators';

export interface PositionChargeDetails {
  brokerage: number;
  stt: number;
  gst: number;
  stampDuty: number;
  transactionCharge: number;
  sebiCharge: number;
}

export interface PositionCharges {
  defaultTotal: number;
  entryPaid: number;
  estCharges: number;
  chargeDetails: PositionChargeDetails;
  isLiveUpstox: boolean;
  showTaxBreakdown: boolean;
  toggleTaxBreakdown: () => void;
}

export function usePositionCharges(pos: Position): PositionCharges {
  const isOpt = pos.isOption !== false;
  const buyPx = Math.max(0, Number(pos.buyPrice || 0));
  const curPx = Number(pos.currentLTP || buyPx);
  const qty = Math.max(1, Number(pos.quantity || 1));

  const defaultCharges = useMemo(() => {
    const breakdown = calculateTradeCharges(
      buyPx,
      qty,
      isOpt,
      curPx,
      pos.instrumentKey || pos.symbol,
    );
    return {
      total: breakdown.roundTripCharges,
      entryPaid: breakdown.buyCharges,
      exitEst: breakdown.sellCharges,
      details: {
        brokerage: breakdown.buyBrokerage + breakdown.sellBrokerage,
        stt: breakdown.stt,
        gst: breakdown.gst,
        stampDuty: breakdown.stampDuty,
        transactionCharge: breakdown.exchangeTxnCharge,
        sebiCharge: breakdown.sebiCharge,
      },
    };
  }, [buyPx, qty, isOpt, curPx, pos.instrumentKey, pos.symbol]);
  const [apiCharges, setApiCharges] = useState<{
    total: number;
    details: PositionChargeDetails;
    isLiveUpstox?: boolean;
  } | null>(null);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const estCharges = apiCharges?.total ?? defaultCharges.total;
  const chargeDetails = (apiCharges?.details ?? defaultCharges.details) as PositionChargeDetails;
  useEffect(() => {
    let isMounted = true;
    const fetchCharges = async () => {
      try {
        if (!pos.buyPrice || !pos.quantity) return;
        const isBseInst = /SENSEX|BANKEX|BSE/i.test(pos.symbol || '');
        const instToken =
          pos.instrumentKey ||
          (pos.isOption
            ? (isBseInst ? 'BSE_FO|' : 'NSE_FO|') + pos.symbol
            : 'NSE_EQ|' + pos.symbol);
        const prod = pos.productType || 'D';
        const currentPx = pos.currentLTP || pos.buyPrice;
        // Fetch Live Round-Trip Brokerage & Taxes directly from Upstox API via server cache
        const r = await fetch(
          `/api/market/brokerage?instrumentToken=${encodeURIComponent(instToken)}&quantity=${pos.quantity}&product=${prod}&buyPrice=${pos.buyPrice}&sellPrice=${currentPx}&roundTrip=true`,
        );
        if (r.ok) {
          const d = await r.json();
          const charges = d?.data?.charges;
          if (isMounted && charges && Number(charges.total) > 0) {
            setApiCharges({
              total: Number(charges.total),
              details: {
                brokerage: Number(charges.brokerage || 60),
                stt: Number(charges.taxes?.stt || 0),
                gst: Number(charges.taxes?.gst || 0),
                stampDuty: Number(charges.taxes?.stamp_duty ?? charges.taxes?.stampDuty ?? 0),
                transactionCharge: Number(
                  charges.other_charges?.transaction ?? charges.taxes?.transactionCharge ?? 0,
                ),
                sebiCharge: Number(
                  charges.other_charges?.sebi_turnover ?? charges.taxes?.sebiCharge ?? 0,
                ),
              },
              isLiveUpstox: Boolean(d?.isLiveUpstox || d?.data?.source === 'UPSTOX_LIVE_API'),
            });
            return;
          }
        }
      } catch {
        // Fallback already safely active from defaultCharges
      }
    };
    fetchCharges();
    return () => {
      isMounted = false;
    };
  }, [
    pos.symbol,
    pos.instrumentKey,
    pos.buyPrice,
    pos.currentLTP,
    pos.quantity,
    pos.productType,
    pos.isOption,
  ]);
  return {
    defaultTotal: defaultCharges.total,
    entryPaid: defaultCharges.entryPaid,
    estCharges,
    chargeDetails,
    isLiveUpstox: Boolean(apiCharges?.isLiveUpstox),
    showTaxBreakdown,
    toggleTaxBreakdown: () => setShowTaxBreakdown((prev) => !prev),
  };
}
