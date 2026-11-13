// Automated Upstox SMS OTP + Auto PIN + Auto OAuth Code + Auto Token Exchange helpers.
import https from "https";
import zlib from "zlib";
import { getUpstoxAgent, markProxyUnhealthy } from "../../services/upstoxTransport";

export interface UpstoxAutoOtpSession {
  requestId: string;
  userId: string;
  internalClientId: string;
  validateOtpToken: string;
  cookies: Record<string, string>;
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  mobile: string;
  pin: string;
  createdAt: number;
}

export const otpSessionState: {
  active: UpstoxAutoOtpSession | null;
  recent: UpstoxAutoOtpSession[];
} = {
  active: null,
  recent: [],
};

const ipv4HttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  timeout: 12000,
  family: 4,
});

export function mergeSetCookies(cookieJar: Record<string, string>, res: any) {
  const rawList: string[] =
    typeof res?.headers?.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : Array.isArray(res?.rawSetCookies)
        ? res.rawSetCookies
        : res?.headers?.get?.("set-cookie")
          ? [res.headers.get("set-cookie") as string]
          : [];
  for (const raw of rawList) {
    if (!raw) continue;
    const firstPart = String(raw).split(";")[0];
    const eqIdx = firstPart.indexOf("=");
    if (eqIdx > 0) {
      const k = firstPart.slice(0, eqIdx).trim();
      const v = firstPart.slice(eqIdx + 1).trim();
      cookieJar[k] = v;
    }
  }
}

export function formatCookieJar(cookieJar: Record<string, string>): string {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

export function buildUpstoxBrowserHeaders(requestId: string, cookieJar: Record<string, string>, extra: Record<string, string> = {}) {
  const cookieStr = formatCookieJar(cookieJar);
  return {
    accept: "*/*",
    "accept-language": "en-GB,en;q=0.9",
    "content-type": "application/json",
    origin: "https://login.upstox.com",
    priority: "u=1, i",
    referer: "https://login.upstox.com/",
    "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "x-device-details":
      "platform=WEB|osName=Mac OS/10.15.7|osVersion=Chrome/140.0.0.0|appVersion=4.0.0|modelName=Chrome|manufacturer=Apple|uuid=3Z1IVTlV4rUUGbNp8KP0|userAgent=Upstox 3.0 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "x-request-id": requestId,
    ...(cookieStr ? { cookie: cookieStr } : {}),
    ...extra,
  };
}

export function httpsRequestIPv4(urlStr: string, options: RequestInit = {}, timeoutMs = 12000): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const method = (options.method || "GET").toUpperCase();
    const rawHeaders: Record<string, string> = {};
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers as Record<string, string>)) {
        if (v !== undefined && v !== null) rawHeaders[k] = String(v);
      }
    }
    const bodyStr = typeof options.body === "string" ? options.body : "";
    if (bodyStr && !rawHeaders["content-length"] && !rawHeaders["Content-Length"]) {
      rawHeaders["content-length"] = String(Buffer.byteLength(bodyStr, "utf-8"));
    }

    const reqAgent = parsed.hostname.includes("upstox") ? getUpstoxAgent() : ipv4HttpsAgent;
    const isUsingProxy = parsed.hostname.includes("upstox") && reqAgent !== ipv4HttpsAgent && (reqAgent as any).proxy !== undefined;

    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method,
        headers: rawHeaders,
        agent: reqAgent,
        family: 4,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          let buffer = Buffer.concat(chunks);
          const enc = String(res.headers["content-encoding"] || "").toLowerCase();
          try {
            if (enc === "gzip") buffer = zlib.gunzipSync(buffer);
            else if (enc === "deflate") buffer = zlib.inflateSync(buffer);
            else if (enc === "br") buffer = zlib.brotliDecompressSync(buffer);
          } catch {
      // Ignored
    }
          const textBody = buffer.toString("utf-8");
          const status = res.statusCode || 200;
          const setCookies: string[] = Array.isArray(res.headers["set-cookie"])
            ? (res.headers["set-cookie"] as string[])
            : res.headers["set-cookie"]
              ? [String(res.headers["set-cookie"])]
              : [];

          resolve({
            status,
            ok: status >= 200 && status < 300,
            rawSetCookies: setCookies,
            headers: {
              get: (name: string) => {
                const val = res.headers[name.toLowerCase()];
                return Array.isArray(val) ? val.join(", ") : val ? String(val) : null;
              },
              getSetCookie: () => setCookies,
            },
            text: async () => textBody,
            json: async () => {
              try {
                return JSON.parse(textBody);
              } catch {
                return {};
              }
            },
          });
        });
      },
    );

    req.on("timeout", () => {
      if (isUsingProxy) {
        markProxyUnhealthy("OTP proxy request timed out");
      }
      req.destroy(new Error("IPv4 request timed out"));
    });
    req.on("error", (err) => {
      if (isUsingProxy) {
        markProxyUnhealthy(err?.message || "OTP proxy socket error");
      }
      reject(err);
    });

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

export async function fetchUpstoxWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
): Promise<any> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await httpsRequestIPv4(url, options, 10000);
    } catch (err: any) {
      lastErr = err;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(url, { ...options, signal: ctrl.signal });
        clearTimeout(timer);
        return res;
      } catch (fetchErr: any) {
        lastErr = fetchErr;
      }
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 350 * (i + 1)));
      }
    }
  }
  throw lastErr;
}
