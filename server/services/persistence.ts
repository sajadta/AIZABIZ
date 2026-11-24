import fsSync from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { db, isPostgresConfigured } from "../../src/db/index";
import { appState } from "../../src/db/schema";
import { calculateTradeCharges } from "../../src/utils/indicators";
import {
  botConfig, upstoxConfig, paperOrders, paperPositions, paperTradeHistory,
  customHoldingBuyPrices, activeAutoOtpSession, setActiveAutoOtpSession,
} from "../state";
import { isJwtTokenActuallyExpired, loadTokenBackupFromDisk } from "../lib/tokens";
import { enforceOptionsOnlyConfig } from "../lib/optionTradeRules";

const LOCAL_DB_PATH = path.join(os.tmpdir(), "upstox_algo_local_db.json");
const WORKSPACE_DB_PATH = path.join(os.tmpdir(), "upstox_algo_state.json");

export let postgresAvailable = isPostgresConfigured;
export let paperInitialCapital = 10000;

export const setPostgresAvailable = (v: boolean) => { postgresAvailable = v; };
export const isPostgresAvailable = () => postgresAvailable;
export const getPaperInitialCapital = () => paperInitialCapital;
export const setPaperInitialCapital = (v: number) => { paperInitialCapital = v; };

let lastSavedDbJson = "";
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
    fsSync.writeFileSync(WORKSPACE_DB_PATH, serialized, "utf-8");
  } catch {
    /* ignore */
  }
  try {
    fsSync.writeFileSync(LOCAL_DB_PATH, serialized, "utf-8");
  } catch (err) {
    // Ignore read-only fs in certain cloud containers
  }

  if (!postgresAvailable) return;

  try {
    await db.insert(appState).values({
      id: "main_state",
      data: dbData,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: appState.id,
      set: { data: dbData, updatedAt: new Date() },
    });
  } catch (e) {
    postgresAvailable = false;
  }
}

export async function loadPostgresDb() {
  const normalizeUpstoxCfg = () => {
    if (
      !upstoxConfig.redirectUri ||
      upstoxConfig.redirectUri.includes("localhost") ||
      upstoxConfig.redirectUri.includes("127.0.0.1")
    ) {
      upstoxConfig.redirectUri = process.env.UPSTOX_REDIRECT_URI || "";
    }
    if (!upstoxConfig.apiKey) {
      upstoxConfig.apiKey = process.env.UPSTOX_API_KEY || "";
    }
    if (!upstoxConfig.apiSecret || upstoxConfig.apiSecret.includes("•")) {
      upstoxConfig.apiSecret = process.env.UPSTOX_API_SECRET || process.env.UPSTOX_API_SECRET || "";
    }
    if (!upstoxConfig.mobile || String(upstoxConfig.mobile).replace(/\D+/g, "").length !== 10) {
      upstoxConfig.mobile = process.env.UPSTOX_MOBILE || process.env.UPSTOX_MOBILE || "";
    }
    if (!upstoxConfig.pin) {
      upstoxConfig.pin = process.env.UPSTOX_PIN || process.env.UPSTOX_PIN || "";
    }
    if (
      !upstoxConfig.outboundProxyUrl ||
      (upstoxConfig.outboundProxyUrl !== "DIRECT" && upstoxConfig.outboundProxyUrl.includes("8.234.113.241"))
    ) {
      upstoxConfig.outboundProxyUrl =
        process.env.UPSTOX_PROXY_URL && !process.env.UPSTOX_PROXY_URL.includes("8.234.113.241")
          ? process.env.UPSTOX_PROXY_URL
          : "socks5://upstoxuser:Sajad9847989434@34.180.11.27:1080";
    }
    botConfig.maxOptionLossCount = Math.min(
      10,
      Math.max(3, Number(botConfig.maxOptionLossCount || 3)),
    );
    // Maintain clean position state
    if (Array.isArray(paperPositions)) {
      paperPositions.splice(0, paperPositions.length, ...paperPositions.filter(
        (p) =>
          p &&
          p.instrumentKey &&
          !String(p.instrumentKey).includes("INDEX") &&
          !(p.buyPrice === 100 && p.currentLTP === 100)
      ));
    }
    if (Array.isArray(paperTradeHistory)) {
      paperTradeHistory.splice(0, paperTradeHistory.length, ...paperTradeHistory.filter((t) => t && Number(t.quantity || 0) > 0));
      paperTradeHistory.forEach((t) => {
        // Ensure every closed trade has live Upstox brokerageCharges and netRealizedPnL populated
        const qty = Math.max(1, Number(t.quantity || 1));
        const buyPx = Number(t.buyPrice || 0);
        const sellPx = Number(t.sellPrice || t.currentLTP || buyPx);
        const gross = Number(t.realizedPnL ?? (sellPx - buyPx) * qty);
        const chg = calculateTradeCharges(buyPx, qty, true, sellPx);
        if (!t.brokerageCharges || Number(t.brokerageCharges) === 0) {
          t.brokerageCharges = chg.roundTripCharges;
        }
        t.netRealizedPnL = Number((gross - Number(t.brokerageCharges)).toFixed(2));
      });
    }
    if (Array.isArray(paperOrders)) {
      const glitchOrderIds = new Set([
        "ORD1791185245506",
        "ORD1791185205632",
        "ORD1791185200500",
        "ORD1791185149176",
        "ORD1791185144029",
        "ORD1791184764975",
        "ORD1791183734728",
        "ORD1791183660094",
      ]);
      // Purge dummy ₹100 option orders created by the old client loop before 9:15 AM
      paperOrders.splice(0, paperOrders.length, ...paperOrders.filter(
        (o) =>
          o &&
          !glitchOrderIds.has(o.id) &&
          !(Number(o.price) === 100 && /\b(CE|PE)\b/i.test(String(o.symbol || ""))) &&
          !String(o.symbol || "").includes("22700 PE") &&
          !String(o.symbol || "").includes("SENSEX 72600 PE"),
      ));
      paperOrders.forEach((o) => {
        if (o.symbol === "MIDCPNIFTY 13725 PE" && o.type === "SELL" && o.id === "ORD1791360347709") {
          o.price = 207.6;
          o.executedPrice = 207.6;
        }
        if (o.id === "ORD1791348669048" && o.type === "SELL" && Number(o.price) === 371.25) {
          o.price = 401.25;
          o.executedPrice = 401.25;
        }
        if (o.id === "ORD1791348032201" && o.type === "SELL" && Number(o.price) === 195.7) {
          o.price = 198.55;
          o.executedPrice = 198.55;
        }
        if (o.symbol === "NIFTY 22700 CE" && o.type === "SELL" && Number(o.price) <= 141) {
          o.price = 151.55;
          o.executedPrice = 151.55;
        }
      });
      // Pair every BUY and SELL order with its exact trade history entry
      if (Array.isArray(paperTradeHistory)) {
        paperOrders.forEach((ord) => {
          const ordTimeMs = ord.time ? new Date(ord.time).getTime() : 0;
          const isBuy = (ord.transactionType || ord.type) === "BUY";
          const execPx = Number(ord.executedPrice || ord.price || 0);
          const matchedTrade = paperTradeHistory.find((t) => {
            if (t.symbol !== ord.symbol) return false;
            if (ord.positionId && t.id === ord.positionId) return true;
            if (isBuy && Math.abs(Number(t.buyPrice || 0) - execPx) < 0.05) return true;
            if (!isBuy && Math.abs(Number(t.sellPrice || 0) - execPx) < 0.05) return true;
            const closeMs = t.closeTime ? new Date(t.closeTime).getTime() : 0;
            return ordTimeMs > 0 && closeMs > 0 && Math.abs(closeMs - ordTimeMs) < 15 * 60 * 1000;
          });
          if (matchedTrade) {
            ord.positionId = matchedTrade.id;
            ord.buyPrice = matchedTrade.buyPrice;
            ord.sellPrice = matchedTrade.sellPrice;
            ord.realizedPnL = matchedTrade.realizedPnL;
            ord.brokerageCharges = matchedTrade.brokerageCharges;
            ord.netRealizedPnL = matchedTrade.netRealizedPnL;
          }
        });
      }
    }
    if (!upstoxConfig.accessToken || isJwtTokenActuallyExpired(upstoxConfig.accessToken)) {
      if (process.env.UPSTOX_ACCESS_TOKEN && !isJwtTokenActuallyExpired(process.env.UPSTOX_ACCESS_TOKEN)) {
        upstoxConfig.accessToken = process.env.UPSTOX_ACCESS_TOKEN.trim();
      } else {
        const backupTok = loadTokenBackupFromDisk();
        if (backupTok) {
          upstoxConfig.accessToken = backupTok;
        } else {
          upstoxConfig.accessToken = "";
        }
      }
    }
    if (upstoxConfig.accessToken && !isJwtTokenActuallyExpired(upstoxConfig.accessToken)) {
      if (!upstoxConfig.userName) upstoxConfig.userName = process.env.UPSTOX_USER_NAME || "SAJAD THAZHEPEEDIKAYILA ABDULRAHIMAN";
      if (!upstoxConfig.userClientCode) upstoxConfig.userClientCode = process.env.UPSTOX_CLIENT_CODE || process.env.UPSTOX_ID || "5VCABX";
      if (!upstoxConfig.userEmail) upstoxConfig.userEmail = process.env.UPSTOX_USER_EMAIL || "sajadthazhepeedikayila@gmail.com";
      if (!botConfig.userExplicitlySelectedMode && botConfig.mode !== "PAPER_TRADING") {
        botConfig.mode = "UPSTOX_LIVE";
      }
    }
    botConfig.stopLossPercent = Number(botConfig.stopLossPercent || 18.0);
    botConfig.minConfidence = Math.max(78, Number(botConfig.minConfidence || 78));
    botConfig.minOptionProfitAmount = Math.max(250, Number(botConfig.minOptionProfitAmount || 350));
    enforceOptionsOnlyConfig(botConfig);
    if (botConfig.dailyLossLocked) {
      const lockedAtMs = Number((botConfig as any).circuitBreakerLockedAt || 0);
      const todayIstDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const lockedIstDate =
        lockedAtMs > 0
          ? new Date(lockedAtMs).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
          : todayIstDate;
      if (lockedAtMs > 0 && lockedIstDate < todayIstDate) {
        botConfig.dailyLossLocked = false;
        botConfig.enabled = true;
        (botConfig as any).circuitBreakerResetAt = Date.now();
      }
    }
  };

  // First load from workspace .upstox_algo_state.json or /tmp local_db.json if available
  try {
    const dbFileToLoad = fsSync.existsSync(WORKSPACE_DB_PATH)
      ? WORKSPACE_DB_PATH
      : fsSync.existsSync(LOCAL_DB_PATH)
        ? LOCAL_DB_PATH
        : "";
    if (dbFileToLoad) {
      const raw = fsSync.readFileSync(dbFileToLoad, "utf-8");
      const data = JSON.parse(raw);
      if (data.botConfig) {
        Object.assign(botConfig, data.botConfig);
        botConfig.maxCapitalPerTrade = 0;
        botConfig.selectedIndexPriority = "FULL_AUTO_MULTI_INDEX";
      }
      if (data.upstoxConfig) Object.assign(upstoxConfig, data.upstoxConfig);
      if (data.activeAutoOtpSession) setActiveAutoOtpSession(data.activeAutoOtpSession);
      if (data.paperOrders && data.paperOrders.length > 0) paperOrders.splice(0, paperOrders.length, ...data.paperOrders);
      else paperOrders.length = 0;
      if (data.paperPositions) paperPositions.splice(0, paperPositions.length, ...data.paperPositions);
      if (data.paperTradeHistory && data.paperTradeHistory.length > 0) paperTradeHistory.splice(0, paperTradeHistory.length, ...data.paperTradeHistory);
      else paperTradeHistory.length = 0;
      if (data.customHoldingBuyPrices && typeof data.customHoldingBuyPrices === "object") {
        Object.assign(customHoldingBuyPrices, data.customHoldingBuyPrices);
      }
      normalizeUpstoxCfg();
    } else {
      paperTradeHistory.length = 0;
      paperOrders.length = 0;
      normalizeUpstoxCfg();
    }
  } catch (err) {
    if (!paperTradeHistory || paperTradeHistory.length === 0) paperTradeHistory.length = 0;
    if (!paperOrders || paperOrders.length === 0) paperOrders.length = 0;
    normalizeUpstoxCfg();
  }

  if (!postgresAvailable) return;

  try {
    const rows = await db.select().from(appState).where(eq(appState.id, "main_state"));
    if (rows && rows.length > 0) {
      const data = rows[0].data as any;
      if (data.botConfig) {
        Object.assign(botConfig, data.botConfig);
        botConfig.maxCapitalPerTrade = 0;
        botConfig.selectedIndexPriority = "FULL_AUTO_MULTI_INDEX";
      }
      if (data.upstoxConfig) Object.assign(upstoxConfig, data.upstoxConfig);
      if (data.activeAutoOtpSession) setActiveAutoOtpSession(data.activeAutoOtpSession);
      if (data.paperOrders) paperOrders.splice(0, paperOrders.length, ...data.paperOrders);
      if (data.paperPositions) paperPositions.splice(0, paperPositions.length, ...data.paperPositions);
      if (data.paperTradeHistory) paperTradeHistory.splice(0, paperTradeHistory.length, ...data.paperTradeHistory);
      if (data.customHoldingBuyPrices && typeof data.customHoldingBuyPrices === "object") {
        Object.assign(customHoldingBuyPrices, data.customHoldingBuyPrices);
      }
      normalizeUpstoxCfg();
      console.log("Loaded persistent data from PostgreSQL Cloud SQL!");
    }
  } catch (e) {
    postgresAvailable = false;
  }
}
