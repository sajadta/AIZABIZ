const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const persistenceLogic = `
import fsSync from 'fs';

const DB_FILE = path.join(process.cwd(), 'local_db.json');

// Helper to save state
function saveLocalDb() {
  const dbData = {
     botConfig,
     upstoxConfig,
     paperOrders,
     paperPositions,
     paperTradeHistory
  };
  try {
     fsSync.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
  } catch(e) { console.error("Failed to save local DB", e); }
}

// Helper to load state
function loadLocalDb() {
  try {
     if (fsSync.existsSync(DB_FILE)) {
         const data = JSON.parse(fsSync.readFileSync(DB_FILE, 'utf-8'));
         if (data.botConfig) botConfig = data.botConfig;
         if (data.upstoxConfig) upstoxConfig = data.upstoxConfig;
         if (data.paperOrders) paperOrders = data.paperOrders;
         if (data.paperPositions) paperPositions = data.paperPositions;
         if (data.paperTradeHistory) paperTradeHistory = data.paperTradeHistory;
         console.log("Loaded persistent data from local_db.json");
     }
  } catch(e) { console.error("Failed to load local DB", e); }
}

// Load it initially
loadLocalDb();

`;

// Insert after let paperTradeHistory = [];
code = code.replace(
    /let paperTradeHistory: any\[\] = \[\];/,
    `let paperTradeHistory: any[] = [];\n${persistenceLogic}`
);

// We need to trigger saveLocalDb() on important state mutations.
// Search for places where upstoxConfig, botConfig, paperOrders, paperPositions, paperTradeHistory are mutated.

fs.writeFileSync('server.ts', code);
console.log("Injected basic persistence block");
