const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const replacement = `
let paperOrders: any[] = [];
let paperPositions: any[] = [];

app.get('/api/trading/orders'`;

code = code.replace("app.get('/api/trading/orders'", replacement);

fs.writeFileSync('server.ts', code);
console.log('Fixed paper variables');
