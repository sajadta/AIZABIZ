const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

// The user wants live data on the Candlestick Chart. We need to append/update the latest candle with the live `quote` LTP.
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
  "  const chartContainerRef = useRef<HTMLDivElement>(null);",
  "  const chartContainerRef = useRef<HTMLDivElement>(null);\n\n" + liveCandleLogic
);

// We need to replace all usages of 'candles.slice' or 'candles.map' with 'displayCandles' inside the component return.
code = code.replace(/candles\.map/g, "displayCandles.map");
code = code.replace(/candles\.slice/g, "displayCandles.slice");
code = code.replace(/candles\.length/g, "displayCandles.length");

fs.writeFileSync('src/components/CandlestickChart.tsx', code);
