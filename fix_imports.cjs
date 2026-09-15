const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(/import \{ appState \} from "\.\/src\/db\/schema\.js";\nimport \{ eq \} from "drizzle-orm";/, '');

code = `import { appState } from "./src/db/schema.js";\nimport { eq } from "drizzle-orm";\n` + code;
// since 'eq' might already be imported, let's fix that if so
code = code.replace(/import { desc } from "drizzle-orm";/, 'import { desc, eq } from "drizzle-orm";');
// remove the extra eq import we just added at top, keep appState
code = code.replace(/import \{ appState \} from "\.\/src\/db\/schema\.js";\nimport \{ eq \} from "drizzle-orm";\n/, 'import { appState } from "./src/db/schema.js";\n');

fs.writeFileSync('server.ts', code);
