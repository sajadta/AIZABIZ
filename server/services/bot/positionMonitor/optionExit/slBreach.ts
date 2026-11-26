// Requires price to hold below the static stop for 3.5s so flash wicks do not trigger exits.
export interface SlBreachParams {
  pos: any;
  trackerObj: any;
  isStaticSlBreachedNow: boolean;
  isUnderlyingParametersReversing: boolean;
  posPnL: number;
  maxAllowedRupeeLoss: number;
}

export function confirmStaticStopLossBreach({
  pos,
  trackerObj,
  isStaticSlBreachedNow,
  isUnderlyingParametersReversing,
  posPnL,
  maxAllowedRupeeLoss,
}: SlBreachParams): boolean {
  let isStaticSlConfirmed = false;
  if (isStaticSlBreachedNow) {
    const breachStart = Number(pos._slBreachAtMs || trackerObj?._slBreachAtMs || 0);
    if (breachStart <= 0) {
      pos._slBreachAtMs = Date.now();
      if (trackerObj) trackerObj._slBreachAtMs = pos._slBreachAtMs;
    } else if (
      Date.now() - breachStart >= 3500 ||
      isUnderlyingParametersReversing ||
      posPnL <= -maxAllowedRupeeLoss * 1.15
    ) {
      isStaticSlConfirmed = true;
    }
  } else {
    pos._slBreachAtMs = 0;
    if (trackerObj) trackerObj._slBreachAtMs = 0;
  }

  return isStaticSlConfirmed;
}
