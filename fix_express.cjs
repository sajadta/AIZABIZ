const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Remove app.use(express.json({ limit: '10mb' })); from where it is
code = code.replace("app.use(express.json({ limit: '10mb' }));", "");

// Add it right after const app = express();
code = code.replace("const app = express();", "const app = express();\napp.use(express.json({ limit: '10mb' }));");

fs.writeFileSync('server.ts', code);
console.log('Fixed express middleware order!');
