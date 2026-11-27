import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { eq } from 'drizzle-orm';
import { db, isPostgresConfigured } from '../../src/db/index';
import { appState } from '../../src/db/schema';
import { isJwtTokenActuallyExpired, loadTokenBackupFromDisk } from '../lib/tokens';
import { enforceOptionsOnlyConfig } from '../lib/optionTradeRules';
import { sanitizeLoadedState } from './persistenceSanitize';
import {
  botConfig,
  upstoxConfig,
  paperOrders,
  paperPositions,
  paperTradeHistory,
  customHoldingBuyPrices,
  activeAutoOtpSession,
  setActiveAutoOtpSession,
} from '../state';

const LOCAL_DB_PATH = path.join(os.tmpdir(), 'upstox_algo_local_db.json');
const WORKSPACE_DB_PATH = path.join(os.tmpdir(), 'upstox_algo_state.json');

export let postgresAvailable = isPostgresConfigured;
export let paperInitialCapital = 10000;

export const setPostgresAvailable = (v: boolean) => {
  postgresAvailable = v;
};
export const isPostgresAvailable = () => postgresAvailable;
export const getPaperInitialCapital = () => paperInitialCapital;
export const setPaperInitialCapital = (v: number) => {
  paperInitialCapital = v;
};

let lastSavedDbJson = '';
const DEFAULT_PRESERVED_TRADES: any[] = [];
const DEFAULT_PRESERVED_ORDERS: any[] = [];

export async function savePostgresDb() {
  enforceOptionsOnlyConfig(botConfig);
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
    fsSync.writeFileSync(WORKSPACE_DB_PATH, serialized, 'utf-8');
  } catch {
    /* ignore */
  }
  try {
    fsSync.writeFileSync(LOCAL_DB_PATH, serialized, 'utf-8');
  } catch (err) {
    // Ignore read-only fs in certain cloud containers
  }

  if (!postgresAvailable) return;

  try {
    await db
      .insert(appState)
      .values({
        id: 'main_state',
        data: dbData,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appState.id,
        set: { data: dbData, updatedAt: new Date() },
      });
  } catch (e) {
    postgresAvailable = false;
  }
}

export async function loadPostgresDb() {
  // First load from workspace .upstox_algo_state.json or /tmp local_db.json if available
  try {
    const dbFileToLoad = fsSync.existsSync(WORKSPACE_DB_PATH)
      ? WORKSPACE_DB_PATH
      : fsSync.existsSync(LOCAL_DB_PATH)
        ? LOCAL_DB_PATH
        : '';
    if (dbFileToLoad) {
      const raw = fsSync.readFileSync(dbFileToLoad, 'utf-8');
      const data = JSON.parse(raw);
      if (data.botConfig) {
        Object.assign(botConfig, data.botConfig);
        botConfig.maxCapitalPerTrade = 0;
        botConfig.selectedIndexPriority = 'FULL_AUTO_MULTI_INDEX';
      }
      if (data.upstoxConfig) Object.assign(upstoxConfig, data.upstoxConfig);
      if (data.activeAutoOtpSession) setActiveAutoOtpSession(data.activeAutoOtpSession);
      if (data.paperOrders && data.paperOrders.length > 0)
        paperOrders.splice(0, paperOrders.length, ...data.paperOrders);
      else paperOrders.length = 0;
      if (data.paperPositions)
        paperPositions.splice(0, paperPositions.length, ...data.paperPositions);
      if (data.paperTradeHistory && data.paperTradeHistory.length > 0)
        paperTradeHistory.splice(0, paperTradeHistory.length, ...data.paperTradeHistory);
      else paperTradeHistory.length = 0;
      if (data.customHoldingBuyPrices && typeof data.customHoldingBuyPrices === 'object') {
        Object.assign(customHoldingBuyPrices, data.customHoldingBuyPrices);
      }
      sanitizeLoadedState();
    } else {
      paperTradeHistory.length = 0;
      paperOrders.length = 0;
      sanitizeLoadedState();
    }
  } catch (err) {
    if (!paperTradeHistory || paperTradeHistory.length === 0) paperTradeHistory.length = 0;
    if (!paperOrders || paperOrders.length === 0) paperOrders.length = 0;
    sanitizeLoadedState();
  }

  if (!postgresAvailable) return;

  try {
    const rows = await db.select().from(appState).where(eq(appState.id, 'main_state'));
    if (rows && rows.length > 0) {
      const data = rows[0].data as any;
      if (data.botConfig) {
        Object.assign(botConfig, data.botConfig);
        botConfig.maxCapitalPerTrade = 0;
        botConfig.selectedIndexPriority = 'FULL_AUTO_MULTI_INDEX';
      }
      if (data.upstoxConfig) Object.assign(upstoxConfig, data.upstoxConfig);
      if (data.activeAutoOtpSession) setActiveAutoOtpSession(data.activeAutoOtpSession);
      if (data.paperOrders) paperOrders.splice(0, paperOrders.length, ...data.paperOrders);
      if (data.paperPositions)
        paperPositions.splice(0, paperPositions.length, ...data.paperPositions);
      if (data.paperTradeHistory)
        paperTradeHistory.splice(0, paperTradeHistory.length, ...data.paperTradeHistory);
      if (data.customHoldingBuyPrices && typeof data.customHoldingBuyPrices === 'object') {
        Object.assign(customHoldingBuyPrices, data.customHoldingBuyPrices);
      }
      sanitizeLoadedState();
      console.log('Loaded persistent data from PostgreSQL Cloud SQL!');
    }
  } catch (e) {
    postgresAvailable = false;
  }
}
