const fs = require('fs');
let code = fs.readFileSync('src/components/CandlestickChart.tsx', 'utf8');

const replacement = `
            const isGreen = c.close >= c.open;
            const color = isGreen ? '#10b981' : '#ef4444';
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(closeY - openY));

            // Determine if there is a signal crossover for this candle
            const prevCandle = i > 0 ? validCandles[i - 1] : null;
            let showBuyArrow = false;
            let showSellArrow = false;

            if (c.supertrendDir === 'BUY' && (!prevCandle || prevCandle.supertrendDir === 'SELL')) {
              showBuyArrow = true;
            } else if (c.supertrendDir === 'SELL' && (!prevCandle || prevCandle.supertrendDir === 'BUY')) {
              showSellArrow = true;
            }

            // Volume bar
            const volHeight = (c.volume / maxVol) * 50;
            const volY = chartHeight - volHeight;

            return (
              <g key={c.timestamp || i}>
                {/* Volume Bar */}
                <rect
                  x={x - barWidth / 2}
                  y={volY}
                  width={barWidth}
                  height={volHeight}
                  fill={isGreen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}
                />

                {/* Wick */}
                <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="1.2" />

                {/* Body */}
                <rect
                  x={x - barWidth / 2}
                  y={bodyY}
                  width={barWidth}
                  height={bodyHeight}
                  fill={color}
                  rx="1"
                />

                {/* Buy Arrow */}
                {showBuyArrow && (
                  <g transform={\`translate(\${x}, \${Math.min(chartHeight - 30, lowY + 15)})\`}>
                    <polygon points="-5,5 5,5 0,-5" fill="#10b981" />
                    <text y="15" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">BUY</text>
                  </g>
                )}

                {/* Sell Arrow */}
                {showSellArrow && (
                  <g transform={\`translate(\${x}, \${Math.max(30, highY - 15)})\`}>
                    <polygon points="-5,-5 5,-5 0,5" fill="#ef4444" />
                    <text y="-10" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="JetBrains Mono">SELL</text>
                  </g>
                )}
              </g>
            );
`;

code = code.replace(
  /            const isGreen = c\.close >= c\.open;\s*const color = isGreen \? '#10b981' : '#ef4444';\s*const bodyY = Math\.min\(openY, closeY\);\s*const bodyHeight = Math\.max\(2, Math\.abs\(closeY - openY\)\);\s*\/\/ Volume bar\s*const volHeight = \(c\.volume \/ maxVol\) \* 50;\s*const volY = chartHeight - volHeight;\s*return \(\s*<g key=\{c\.timestamp \|\| i\}>\s*\{\/\* Volume Bar \*\/\}\s*<rect\s*x=\{x - barWidth \/ 2\}\s*y=\{volY\}\s*width=\{barWidth\}\s*height=\{volHeight\}\s*fill=\{isGreen \? 'rgba\(16, 185, 129, 0\.15\)' : 'rgba\(239, 68, 68, 0\.15\)'\}\s*\/>\s*\{\/\* Wick \*\/\}\s*<line x1=\{x\} y1=\{highY\} x2=\{x\} y2=\{lowY\} stroke=\{color\} strokeWidth="1\.2" \/>\s*\{\/\* Body \*\/\}\s*<rect\s*x=\{x - barWidth \/ 2\}\s*y=\{bodyY\}\s*width=\{barWidth\}\s*height=\{bodyHeight\}\s*fill=\{color\}\s*rx="1"\s*\/>\s*<\/g>\s*\);/,
  replacement
);

fs.writeFileSync('src/components/CandlestickChart.tsx', code);
