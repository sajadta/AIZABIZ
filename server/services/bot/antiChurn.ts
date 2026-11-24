// Smart Dynamic Anti-Churn & Re-entry Guard state shared by the bot tick.
export const strikeDailyEntryCount: Record<string, number> = {};
export const STRIKE_LOCKOUT_MS = 45 * 1000; // 45-second exchange double-fill guard
export const STRIKE_LOCKOUT_MIN_MS = 30 * 1000; // 30-second stabilization buffer
export const STRIKE_LOSS_LOCKOUT_MS = 15 * 60 * 1000; // 15-min cooldown on the exact same strike after a net loss
export const MAX_STRIKE_ENTRIES_DEFAULT = 3;
export const MAX_STRIKE_ENTRIES_TRENDING = 5;
