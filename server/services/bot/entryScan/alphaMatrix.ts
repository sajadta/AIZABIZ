// Ranks the current tick's per-index candidates so the UI can show which index
// carries the strongest institutional alpha right now.

export interface AlphaCandidate {
  signalType?: string;
  alphaOpportunityScore?: number;
  confidenceScore?: number;
  rank?: number;
  isTopPick?: boolean;
}

export const rankAlphaCandidates = <T extends AlphaCandidate>(candidates: T[]): T[] => {
  if (candidates.length === 0) return candidates;

  candidates.sort((a, b) => {
    const aActive = a.signalType !== 'HOLD' ? 1000 : 0;
    const bActive = b.signalType !== 'HOLD' ? 1000 : 0;
    return (
      bActive +
      (b.alphaOpportunityScore || 0) +
      (b.confidenceScore || 0) -
      (aActive + (a.alphaOpportunityScore || 0) + (a.confidenceScore || 0))
    );
  });

  candidates.forEach((item, index) => {
    item.rank = index + 1;
    item.isTopPick = index === 0 && item.signalType !== 'HOLD';
  });

  return candidates;
};
