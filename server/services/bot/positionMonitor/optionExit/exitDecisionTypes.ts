export interface OptionExitDecisionParams {
  pos: any;
  isEodSquareOff: boolean;
  isBtstHoldRecommended: boolean;
  latestUnderlyingSig: any;
  openedMs: number;
  optCandlesActive: any[];
}

export interface OptionExitDecision {
  shouldSell: boolean;
  sellReason: string;
  dynamicStopLossPrice: number;
  qty: number;
  posProdCode: string;
  posTrackerKey: string;
}
