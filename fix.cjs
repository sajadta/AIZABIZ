const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

const liveCandleLogic = `
  const displayCandles = useMemo(() => {
    if (candles.length === 0) return [];
    
    // Create a copy of the candles
    const currentCandles = [...candles];
    const lastCandleIndex = currentCandles.length - 1;
    
    // If we have a live quote, update the last candle's close, high, and low dynamically
    if (quote && quote.ltp) {
       const lastCandle = { ...currentCandles[lastCandleIndex] };
       
       // Update close to current LTP
       lastCandle.close = quote.ltp;
       
       // Expand high/low if current LTP exceeds them
       if (quote.ltp > lastCandle.high) lastCandle.high = quote.ltp;
       if (quote.ltp < lastCandle.low) lastCandle.low = quote.ltp;
       
       currentCandles[lastCandleIndex] = lastCandle;
    }
    
    return currentCandles;
  }, [candles, quote]);
`;

code = code.replace(
  "  const containerRef = useRef<HTMLDivElement>(null);",
  "  const containerRef = useRef<HTMLDivElement>(null);\n\n" + liveCandleLogic
);

fs.writeFileSync('src/components/CandlestickChart.tsx', code);
