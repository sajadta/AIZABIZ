const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf-8');

serverCode = serverCode.replace(
  /const DB_FILE = [\s\S]*?setInterval\(saveLocalDb, 5000\);/m,
  `import { appState } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

async function savePostgresDb() {
  const dbData = {
    botConfig,
    upstoxConfig,
    paperOrders,
    paperPositions,
    paperTradeHistory,
  };
  try {
    await db.insert(appState).values({
      id: 'main_state',
      data: dbData,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: appState.id,
      set: { data: dbData, updatedAt: new Date() }
    });
  } catch (e) {
    console.error("Failed to save Postgres DB", e);
  }
}

async function loadPostgresDb() {
  try {
    const rows = await db.select().from(appState).where(eq(appState.id, 'main_state'));
    if (rows && rows.length > 0) {
      const data = rows[0].data as any;
      if (data.botConfig) botConfig = data.botConfig;
      if (data.upstoxConfig) upstoxConfig = data.upstoxConfig;
      if (data.paperOrders) paperOrders = data.paperOrders;
      if (data.paperPositions) paperPositions = data.paperPositions;
      if (data.paperTradeHistory) paperTradeHistory = data.paperTradeHistory;
      console.log("Loaded persistent data from PostgreSQL Cloud SQL!");
    }
  } catch (e) {
    console.error("Failed to load Postgres DB", e);
  }
}

loadPostgresDb().then(() => {
  setInterval(savePostgresDb, 5000);
});`
);

fs.writeFileSync('server.ts', serverCode);
console.log('Patched DB saving in server.ts');
