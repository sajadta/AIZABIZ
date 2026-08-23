const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const botLoopTarget = `         const pnlPercent = ((ltp - pos.buyPrice)  / pos.buyPrice)  * 100;
         
         if (pnlPercent >= botConfig.targetProfitPercent)  {
             botLogs.unshift({ id: Date.now() .toString(), time: new Date() .toLocaleTimeString(), message: \`Target Profit hit (\${pnlPercent.toFixed(2) }%)  for \${pos.symbol}. Squaring off.\`, type: 'SUCCESS' });`;

const botLoopReplace = `         // Track highest LTP for trailing stop loss
         pos.highestLTP = Math.max(pos.highestLTP || pos.buyPrice, ltp);
         
         const pnlPercent = ((ltp - pos.buyPrice) / pos.buyPrice) * 100;
         let shouldSell = false;
         let sellReason = '';

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

         if (shouldSell) {
             botLogs.unshift({ id: Date.now().toString(), time: new Date().toLocaleTimeString(), message: sellReason, type: pnlPercent > 0 ? 'SUCCESS' : 'ERROR' });`;

const closingBraceReplaceTarget = `         } else if (pnlPercent <= -botConfig.stopLossPercent)  {
             botLogs.unshift({ id: Date.now() .toString(), time: new Date() .toLocaleTimeString(), message: \`Stop Loss hit (\${pnlPercent.toFixed(2) }%)  for \${pos.symbol}. Squaring off.\`, type: 'ERROR' });
             if (botConfig.mode === 'PAPER_TRADING')  {
                 paperPositions = paperPositions.filter(p => p.id !== pos.id);
             } else if (botConfig.mode === 'UPSTOX_LIVE')  {
                 // Place sell order via Upstox API
                 try {
                     await fetch('https://api.upstox.com/v2/order/place', {
                         method: 'POST',
                         headers: {
                             'Content-Type': 'application/json',
                             'Accept': 'application/json',
                             'Authorization': \`Bearer \${token}\`,
                             'Api-Version': '2.0'
                         },
                         body: JSON.stringify({
                             quantity: pos.quantity,
                             product: 'D', // Defaulting to Delivery for options, ideally  atch pos product
                             validity: 'DAY',
                             price: 0,
                             tag: 'bot_stop_loss',
                             instrument_token: pos.instrumentKey,
                             order_type: 'MARKET',
                             transaction_type: 'SELL',
                             disclosed_quantity: 0,
                             trigger_price: 0,
                             is_amo: false
                         })
                      });
                 } catch(e)  {}
             }
         }`;

code = code.replace(botLoopTarget, botLoopReplace);
code = code.replace(closingBraceReplaceTarget, ""); // Remove the static stop loss block since we merged it

fs.writeFileSync('server.ts', code);
console.log('Bot Auto Trailing logic applied');
