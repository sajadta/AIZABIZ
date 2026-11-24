// Symbol normalization, IST timestamp helpers and trade-id ordering used by the
// historical trade pairing logic.

export function normalizeEquityBaseSymbol(symbol: string): string {
  return String(symbol || "")
    .trim()
    .toUpperCase()
    .replace(/-(EQ|BE|BZ|SM|ST)$/i, "");
}

export function toIstIsoTimestamp(raw?: string): string {
  const s = String(raw || "").trim();
  if (!s) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s}T15:30:00+05:30`;
  }
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(s)) {
    return s.replace(" ", "T") + "+05:30";
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function getTodayIstDateString(nowMs = Date.now()): string {
  return new Date(nowMs).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function getCurrentIndianFinancialYearStart(todayIst: string): string {
  const [yStr, mStr] = todayIst.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const fyStartYear = m >= 4 ? y : y - 1;
  return `${fyStartYear}-04-01`;
}

export function isOptionSymbolOrToken(sym: string, token = "", optionType = ""): boolean {
  if (optionType === "CE" || optionType === "PE") return true;
  if (/\b(CE|PE)\b/i.test(sym) || /(CE|PE)$/i.test(sym.trim())) return true;
  if (token.includes("_FO|")) return true;
  return false;
}

export function compareTradeIds(aId: unknown, bId: unknown): number {
  const sA = String(aId || "").trim();
  const sB = String(bId || "").trim();
  const nA = Number(sA);
  const nB = Number(sB);
  if (sA !== "" && sB !== "" && Number.isFinite(nA) && Number.isFinite(nB) && nA !== nB) {
    return nA - nB;
  }
  return sA.localeCompare(sB);
}
