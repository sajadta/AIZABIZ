// Smart Dynamic Anti-Churn & Re-entry Guard state shared by the bot tick.
export const strikeDailyEntryCount: Record<string, number> = {};
export const STRIKE_LOCKOUT_MS = 180 * 1000; // 3-minute anti-churn buffer to prevent rapid revenge trading
export const STRIKE_LOCKOUT_MIN_MS = 120 * 1000; // 2-minute stabilization buffer
export const MAX_STRIKE_ENTRIES_DEFAULT = 4; // Max 4 high-quality trades per strike per day to prevent overtrading
export const MAX_STRIKE_ENTRIES_TRENDING = 6; // Max 6 entries on strong trending days
