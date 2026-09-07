const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldLogic = `
         // 1. Static Target Check
         if (pnlPercent >= botConfig.targetProfitPercent && !botConfig.trailingStopLoss) {
             shouldSell = true;
             sellReason = \`Target Profit hit (\${pnlPercent.toFixed(2)}%) for \${pos.symbol}. Maximum profit locked!\`;
         } 
         // 2. Trailing Stop Loss (Auto Change Stoploss / Target)
         else if (botConfig.trailingStopLoss) {
             const trailingStopPrice = pos.highestLTP * (1 - (botConfig.trailingStepPercent || 5) / 100);
             const dynamicTargetPrice = pos.highestLTP * (1 + (botConfig.targetProfitPercent || 10) / 100);
             
             if (ltp <= trailingStopPrice) {
                shouldSell = true;
                const profitDiff = ((ltp - pos.buyPrice) / pos.buyPrice) * 100;
                if (profitDiff > 0) {
                    sellReason = \`Trailing Stop Loss triggered! Secured profit of \${profitDiff.toFixed(2)}% on \${pos.symbol}.\`;
                } else {
                    sellReason = \`Trailing Stop Loss hit (\${profitDiff.toFixed(2)}%) for \${pos.symbol}. Minimizing loss.\`;
                }
             } else if (ltp >= dynamicTargetPrice) {
                shouldSell = true;
                sellReason = \`Dynamic Trailing Target hit (\${pnlPercent.toFixed(2)}%) for \${pos.symbol}. Max profit reached!\`;
             }
         }
         // 3. Static Stop Loss
         if (!shouldSell && pnlPercent <= -botConfig.stopLossPercent) {
             shouldSell = true;
             sellReason = \`Stop Loss hit (\${pnlPercent.toFixed(2)}%) for \${pos.symbol}. Squaring off to prevent further loss.\`;
         }
`;

const newLogic = `
         // Static Stop and Target values based on BUY price
         const staticStopLossPrice = pos.buyPrice * (1 - (botConfig.stopLossPercent || 10) / 100);
         const staticTargetPrice = pos.buyPrice * (1 + (botConfig.targetProfitPercent || 30) / 100);

         // 1. Static Target Check
         if (ltp >= staticTargetPrice) {
             shouldSell = true;
             sellReason = \`Perfect Target Profit hit (\${pnlPercent.toFixed(2)}%) for \${pos.symbol}. Maximum profit locked!\`;
         } 
         // 2. Trailing Stop Loss (Smart Trailing)
         else if (botConfig.trailingStopLoss) {
             // Calculate trailing stop based on highest achieved price
             const trailingStopPrice = pos.highestLTP * (1 - (botConfig.trailingStepPercent || 5) / 100);
             
             // To prevent exiting at a loss when the trade was in profit, 
             // we ensure the stop loss is at least the buy price if highestLTP is significantly higher.
             // (Cost-to-Cost trailing). If profit reached > trailingStepPercent, never exit in loss.
             const isCostToCostActive = pos.highestLTP >= pos.buyPrice * (1 + (botConfig.trailingStepPercent || 5) / 100);
             const effectiveStopPrice = isCostToCostActive 
                 ? Math.max(trailingStopPrice, pos.buyPrice * 1.005) // Lock tiny profit to cover brokerage
                 : Math.max(trailingStopPrice, staticStopLossPrice); // Standard trail, but never lower than strict SL
             
             if (ltp <= effectiveStopPrice) {
                shouldSell = true;
                const profitDiff = ((ltp - pos.buyPrice) / pos.buyPrice) * 100;
                if (profitDiff > 0) {
                    sellReason = \`Smart Trailing Stop triggered! Secured profit of \${profitDiff.toFixed(2)}% on \${pos.symbol}.\`;
                } else {
                    sellReason = \`Smart Stop Loss hit (\${profitDiff.toFixed(2)}%) for \${pos.symbol}. Minimizing loss.\`;
                }
             }
         }
         // 3. Static Stop Loss (if trailing is off)
         else if (!shouldSell && ltp <= staticStopLossPrice) {
             shouldSell = true;
             sellReason = \`Strict Stop Loss hit (\${pnlPercent.toFixed(2)}%) for \${pos.symbol}. Squaring off to prevent further loss.\`;
         }
`;

// Note: I will replace the exact text to be safe
code = code.replace(
    /\/\/ 1\. Static Target Check[\s\S]*squaring off to prevent further loss\.`;\n         }/m,
    newLogic.trim()
);

fs.writeFileSync('server.ts', code);
console.log("Patched exit logic");
