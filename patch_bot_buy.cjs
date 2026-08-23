const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `                   paperOrders.unshift({ id: 'ORD'+Date.now(), symbol: optionSymbol, type: 'BUY', quantity: 50, price: optionPrice, status: 'COMPLETE', time: new Date() .toISOString()  });
                   paperPositions.push({ id: 'POS'+Date.now(), symbol: optionSymbol, quantity: 50, buyPrice: optionPrice, currentLTP: optionPrice, pnl: 0, type: 'BUY' });
                }`;

const replacement = `                   paperOrders.unshift({ id: 'ORD'+Date.now(), symbol: optionSymbol, type: 'BUY', quantity: 50, price: optionPrice, status: 'COMPLETE', time: new Date() .toISOString()  });
                   paperPositions.push({ id: 'POS'+Date.now(), symbol: optionSymbol, quantity: 50, buyPrice: optionPrice, currentLTP: optionPrice, pnl: 0, type: 'BUY' });
                } else if (botConfig.mode === 'UPSTOX_LIVE' && token) {
                    try {
                        const optInstrumentKey = 'NSE_FO|' + optionSymbol;
                        await fetch('https://api.upstox.com/v2/order/place', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'Authorization': \`Bearer \${token}\`,
                                'Api-Version': '2.0'
                            },
                            body: JSON.stringify({
                                quantity: botConfig.tradeQuantity || 50,
                                product: 'D', 
                                validity: 'DAY',
                                price: 0,
                                tag: 'bot_auto_entry',
                                instrument_token: optInstrumentKey,
                                order_type: 'MARKET',
                                transaction_type: 'BUY',
                                disclosed_quantity: 0,
                                trigger_price: 0,
                                is_amo: false
                            })
                         });
                    } catch(err) {
                        console.error('Error placing auto buy order:', err);
                    }
                }`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('server.ts', code);
    console.log('Bot Auto Buy Patched');
} else {
    console.log('Target not found');
}
