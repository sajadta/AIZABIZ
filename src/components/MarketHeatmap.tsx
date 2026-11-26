import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { StockQuote } from '../types';

interface MarketHeatmapProps {
  quotes: StockQuote[];
}

/** Treemap node data: sectors carry children, leaves carry size/colour values. */
interface HeatmapNodeData {
  name: string;
  value?: number;
  change?: number;
  ltp?: number;
  children?: HeatmapNodeData[];
}

// Hardcoded sectors for common NIFTY 50 stocks for grouping in the treemap
const STOCK_SECTORS: Record<string, string> = {
  RELIANCE: 'Energy',
  TCS: 'IT',
  INFY: 'IT',
  HDFCBANK: 'Financial Services',
  ICICIBANK: 'Financial Services',
  SBI: 'Financial Services',
  SBIN: 'Financial Services',
  KOTAKBANK: 'Financial Services',
  AXISBANK: 'Financial Services',
  HINDUNILVR: 'Consumer Goods',
  ITC: 'Consumer Goods',
  LT: 'Construction',
  BAJFINANCE: 'Financial Services',
  BHARTIARTL: 'Telecom',
  HCLTECH: 'IT',
  ASIANPAINT: 'Consumer Goods',
  MARUTI: 'Automobile',
  TATAMOTORS: 'Automobile',
  'M&M': 'Automobile',
  SUNPHARMA: 'Pharma',
  TITAN: 'Consumer Goods',
  ULTRACEMCO: 'Cement',
  NTPC: 'Energy',
  ONGC: 'Energy',
  POWERGRID: 'Energy',
  TATASTEEL: 'Metals',
  JSWSTEEL: 'Metals',
  HINDALCO: 'Metals',
  TECHM: 'IT',
  WIPRO: 'IT',
  DRREDDY: 'Pharma',
  CIPLA: 'Pharma',
  DIVISLAB: 'Pharma',
  APOLLOHOSP: 'Healthcare',
  'NIFTY 50': 'Index',
  'NIFTY BANK': 'Index',
  SENSEX: 'Index',
  BANKEX: 'Index',
  'NIFTY FIN SERVICE': 'Index',
};

export const MarketHeatmap: React.FC<MarketHeatmapProps> = ({ quotes }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 360, height: 400 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const nextWidth = containerRef.current.clientWidth || 360;
        const nextHeight = Math.max(350, containerRef.current.clientHeight || 400);
        setDimensions((prev) =>
          prev.width === nextWidth && prev.height === nextHeight
            ? prev
            : { width: nextWidth, height: nextHeight },
        );
      }
    };

    handleResize();
    const ro = new ResizeObserver(() => handleResize());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Process data for treemap
  const hierarchicalData = useMemo(() => {
    const root: HeatmapNodeData = { name: 'Market', children: [] };
    const sectorsMap = new Map<string, HeatmapNodeData>();

    // If there are no quotes or very few, we might want to add some mock data for the visualization to look good
    // But we will use the actual quotes passed in.
    const displayQuotes = quotes.filter((q) => q.segment !== 'OPTIONS');

    displayQuotes.forEach((quote) => {
      // Use predefined sector or default to 'Other'
      let sectorName = STOCK_SECTORS[quote.symbol] || 'Other';
      if (quote.segment === 'INDEX') sectorName = 'Indices';

      if (!sectorsMap.has(sectorName)) {
        sectorsMap.set(sectorName, { name: sectorName, children: [] });
      }

      const sectorNode = sectorsMap.get(sectorName);
      if (!sectorNode) return;

      // Calculate a "size" (market cap equivalent or volume). Since we might not have it, use 1 or absolute change
      // For treemaps, size cannot be negative or zero
      const size = quote.ltp > 0 ? quote.ltp : 100;

      (sectorNode.children ||= []).push({
        name: quote.symbol,
        value: size, // Drives area size
        change: quote.changePercent, // Drives color
        ltp: quote.ltp,
      });
    });

    root.children = Array.from(sectorsMap.values());
    return root;
  }, [quotes]);

  useEffect(() => {
    if (!containerRef.current || dimensions.width === 0) return;

    // Clear previous SVG
    d3.select(containerRef.current).selectAll('*').remove();

    const { width, height } = dimensions;

    const svg = d3
      .select(containerRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('display', 'block')
      .style('font-family', 'sans-serif');

    // Create hierarchy and treemap layout
    const padding = 2;
    const root = d3
      .treemap<HeatmapNodeData>()
      .size([width, height])
      .paddingTop(20)
      .paddingRight(padding)
      .paddingInner(padding)(
      d3
        .hierarchy<HeatmapNodeData>(hierarchicalData)
        .sum((d) => d.value || 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0)),
    );

    // Color scale mapping - % change to red/green
    const colorScale = d3
      .scaleLinear<string>()
      .domain([-3, 0, 3])
      .range(['#ef4444', '#334155', '#22c55e']) // red-500, slate-700, green-500
      .clamp(true);

    // Draw Sector groups
    const sectorNodes = svg
      .selectAll('g.sector')
      .data(root.children || [])
      .enter()
      .append('g')
      .attr('class', 'sector')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    sectorNodes
      .append('rect')
      .attr('width', (d) => d.x1 - d.x0)
      .attr('height', (d) => d.y1 - d.y0)
      .attr('fill', 'none')
      .attr('stroke', '#475569') // slate-600
      .attr('stroke-width', 1);

    // Sector Titles
    sectorNodes
      .append('text')
      .attr('x', 4)
      .attr('y', 14)
      .attr('fill', '#94a3b8') // slate-400
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text((d) => d.data.name);

    // Draw individual stock cells
    const leaves = root.leaves();

    const cell = svg
      .selectAll('g.cell')
      .data(leaves)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    // Cell background
    cell
      .append('rect')
      .attr('width', (d) => d.x1 - d.x0)
      .attr('height', (d) => d.y1 - d.y0)
      .attr('fill', (d) => (d.data.change ? colorScale(d.data.change) : '#334155'))
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2)
      .attr('rx', 2);

    // Add interactivity
    cell
      .on('mouseover', function () {
        d3.select(this).select('rect').attr('stroke', '#f8fafc').attr('stroke-width', 2);
      })
      .on('mouseout', function () {
        d3.select(this).select('rect').attr('stroke', '#0f172a').attr('stroke-width', 2);
      });

    // Append labels to cells large enough
    cell.each(function (d) {
      const node = d3.select(this);
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;

      // Only add text if cell is large enough
      if (w > 40 && h > 30) {
        // Ticker
        node
          .append('text')
          .attr('x', w / 2)
          .attr('y', h / 2 - 4)
          .attr('text-anchor', 'middle')
          .attr('fill', '#ffffff')
          .attr('font-size', w > 60 ? '12px' : '9px')
          .attr('font-weight', 'bold')
          .text(d.data.name);

        // Change %
        node
          .append('text')
          .attr('x', w / 2)
          .attr('y', h / 2 + 10)
          .attr('text-anchor', 'middle')
          .attr('fill', 'rgba(255,255,255,0.9)')
          .attr('font-size', w > 60 ? '10px' : '8px')
          .text(
            d.data.change ? `${d.data.change > 0 ? '+' : ''}${d.data.change.toFixed(2)}%` : '0.00%',
          );
      }
    });
  }, [hierarchicalData, dimensions]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Market Heatmap</h3>
          <p className="text-xs text-slate-400">Sector performance based on live % change</p>
        </div>
        <div className="flex space-x-2 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-sm mr-1"></div> Bearish
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-slate-600 rounded-sm mr-1"></div> Neutral
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-sm mr-1"></div> Bullish
          </div>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 w-full min-h-[400px] relative overflow-hidden"
      ></div>
    </div>
  );
};
