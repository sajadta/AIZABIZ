const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(/import \{ desc \} from "drizzle-orm";/, 'import { desc, eq } from "drizzle-orm";');
fs.writeFileSync('server.ts', code);
