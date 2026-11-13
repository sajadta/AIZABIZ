// Low-level Upstox access-token persistence and JWT expiry helpers.
// These have no dependency on the HTTP layer, so both the persistence and
// auth services can import them without creating a cycle.
import fsSync from "fs";
import { upstoxConfig, invalidTokens, PERSISTENT_TOKEN_BACKUP_PATH } from "../state";

export function isJwtTokenActuallyExpired(tokenStr: string): boolean {
  try {
    const parts = (tokenStr || "").trim().split(".");
    if (parts.length !== 3) return false;
    const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
    const payload = JSON.parse(payloadJson);
    if (payload && typeof payload.exp === "number") {
      // Allow 60s clock skew buffer
      return Date.now() / 1000 > payload.exp + 60;
    }
  } catch {}
  return false;
}

export function saveTokenBackupToDisk(tokenStr: string, meta?: Record<string, any>) {
  const clean = (tokenStr || "").trim();
  if (!clean || clean.length < 30 || isJwtTokenActuallyExpired(clean)) return;
  try {
    fsSync.writeFileSync(
      PERSISTENT_TOKEN_BACKUP_PATH,
      JSON.stringify(
        {
          accessToken: clean,
          userName: meta?.userName || upstoxConfig.userName || process.env.UPSTOX_USER_NAME || "",
          userClientCode: meta?.userClientCode || upstoxConfig.userClientCode || process.env.UPSTOX_CLIENT_CODE || "",
          savedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf-8",
    );
  } catch {}
}

export function loadTokenBackupFromDisk(): string {
  try {
    if (fsSync.existsSync(PERSISTENT_TOKEN_BACKUP_PATH)) {
      const raw = fsSync.readFileSync(PERSISTENT_TOKEN_BACKUP_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      const tok = String(parsed?.accessToken || "").trim();
      if (tok.length > 30 && !isJwtTokenActuallyExpired(tok) && !invalidTokens.has(tok)) {
        return tok;
      }
    }
  } catch {}
  return "";
}
