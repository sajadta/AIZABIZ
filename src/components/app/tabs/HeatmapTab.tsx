import React from 'react';
import { MarketHeatmap } from '../../MarketHeatmap';
import type { StockQuote } from '../../../types';

interface HeatmapTabProps {
  quotes: StockQuote[];
}

export const HeatmapTab: React.FC<HeatmapTabProps> = ({ quotes }) => (
  <div className="h-full w-full max-w-full min-w-0 overflow-hidden pb-28 lg:pb-4">
    <MarketHeatmap quotes={quotes} />
  </div>
);
