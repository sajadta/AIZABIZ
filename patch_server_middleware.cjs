const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf-8');

const middleware = `// 2. Upstox API Auth & Configuration
app.use('/api/market', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        if (token && token.length > 10) {
            upstoxConfig.accessToken = token;
        }
    }
    next();
});

`;

serverCode = serverCode.replace('// 2. Upstox API Auth & Configuration', middleware);

fs.writeFileSync('server.ts', serverCode);
console.log("Patched server.ts with auth middleware");
