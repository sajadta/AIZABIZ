const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `  // For LIVE UPSTOX, we'd place order using Upstox API
  res.json({ success: false, error: 'Live order placement requires verified Upstox API' });
});`;

const replacement = `  if (mode === 'UPSTOX_LIVE') {
    const token = upstoxConfig.accessToken;
    if (!token) return res.status(401).json({ success: false, error: 'Upstox Token missing' });
    
    // Attempt real order
    try {
        let instrKey = symbol;
        if (!symbol.includes('|')) {
           // Basic guess for instrument key if symbol is plain
           if (symbol.includes('CE') || symbol.includes('PE')) instrKey = 'NSE_FO|' + symbol;
           else instrKey = 'NSE_EQ|' + symbol;
        }

        const orderRes = await fetch('https://api.upstox.com/v2/order/place', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': \`Bearer \${token}\`,
                'Api-Version': '2.0'
            },
            body: JSON.stringify({
                quantity: Number(quantity) || 1,
                product: 'D', 
                validity: 'DAY',
                price: Number(price) || 0,
                tag: 'manual_ui_order',
                instrument_token: instrKey,
                order_type: Number(price) > 0 ? 'LIMIT' : 'MARKET',
                transaction_type: initialType,
                disclosed_quantity: 0,
                trigger_price: 0,
                is_amo: false
            })
         });
         
         const data = await orderRes.json();
         if (data.status === 'success') {
             return res.json({ success: true, order: data.data });
         } else {
             return res.json({ success: false, error: data.errors?.[0]?.message || 'Order failed' });
         }
    } catch(err: any) {
        return res.json({ success: false, error: err.message });
    }
  }
  res.json({ success: false, error: 'Invalid mode' });
});`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('server.ts', code);
    console.log('Manual Order Patched');
} else {
    console.log('Target not found');
}
