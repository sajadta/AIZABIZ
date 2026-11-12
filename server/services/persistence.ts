import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { 
  botConfig, upstoxConfig, activeAutoOtpSession, paperOrders, paperPositions, 
  paperTradeHistory, customHoldingBuyPrices 
} from '../state';
import { db } from '../../src/db/index';
import { appState } from '../../src/db/schema';

const LOCAL_DB_PATH = path.join(os.tmpdir(), "upstox_algo_local_db.json");
const WORKSPACE_DB_PATH = path.join(process.cwd(), ".upstox_algo_state.json");
let lastSavedDbJson = "";

export async function savePostgresDb() {
  const dbData = {
    botConfig,
    upstoxConfig,
    activeAutoOtpSession,
    paperOrders,
    paperPositions,
    paperTradeHistory,
    customHoldingBuyPrices,
  };

  const serialized = JSON.stringify(dbData, null, 2);
  if (serialized === lastSavedDbJson) return;
  lastSavedDbJson = serialized;

  try {
    fsSync.writeFileSync(WORKSPACE_DB_PATH, serialized, "utf-8");
  } catch {}
  try {
    fsSync.writeFileSync(LOCAL_DB_PATH, serialized, "utf-8");
  } catch (err) {
    // Ignore
  }

  // Check if postgres is available (we can import it from a state or just try/catch)
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
    // Silently fail if postgres is not available
  }
}
