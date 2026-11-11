import dns from "dns";
import net from "net";
import https from "https";
try {
  dns.setDefaultResultOrder("ipv4first");
  if (typeof (net as any).setDefaultAutoSelectFamily === "function") {
    (net as any).setDefaultAutoSelectFamily(false);
  }
} catch {}


export const FIXED_PRIMARY_IP = "8.234.113.241";
export const FIXED_SECONDARY_IP = "34.34.254.178";

const upstoxIpv4Agent = new https.Agent({
  family: 4,
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 30,
  maxFreeSockets: 15,
  timeout: 30000,
});

function getUpstoxAgent() {
  return upstoxIpv4Agent;
}

let isProxyReachable = true;
let lastProxyCheckTime = 0;

async function upstoxFetch(url: string, options: any = {}): Promise<Response> {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(new Response(JSON.stringify({ error: "Upstox Proxy Request Timeout" }), { status: 500 }));
      }
    }, 8000);

    try {
      const agent = getUpstoxAgent();
      const headers = { ...(options.headers || {}) };
      const method = options.method || "GET";
      const bodyData = options.body;

      if (bodyData && !headers["Content-Length"] && !headers["content-length"]) {
        const str = typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData);
        headers["Content-Length"] = Buffer.byteLength(str);
      }

      const req = https.request(
        url,
        {
          method,
          agent,
          family: 4,
          headers,
        },
        (res) => {
          if (resolved) return;
          clearTimeout(timer);
          resolved = true;
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const bodyBuffer = Buffer.concat(chunks);
            const response = new Response(bodyBuffer, {
              status: res.statusCode || 200,
              statusText: res.statusMessage || "",
              headers: res.headers as any,
            });
            resolve(response);
          });
        }
      );

      req.on("error", (err: any) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(new Response(JSON.stringify({ error: err?.message || "Proxy Network Error" }), { status: 500 }));
        }
      });

      if (bodyData) {
        req.write(typeof bodyData === "string" ? bodyData : JSON.stringify(bodyData));
      }
      req.end();
    } catch (e) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        isProxyReachable = false;
        lastProxyCheckTime = Date.now();
        originalNativeFetch(url, options).then(resolve).catch((err) => resolve(new Response(JSON.stringify({ error: err.message }), { status: 500 })));
      }
    }
  });
}

const originalNativeFetch = globalThis.fetch;
globalThis.fetch = function (input: any, init?: any): Promise<Response> {
  const urlStr = typeof input === "string" ? input : input?.url || "";
  if (typeof urlStr === "string" && urlStr.includes("api.upstox.com")) {
    return upstoxFetch(urlStr, init);
  }
  return originalNativeFetch(input, init);
};

export async function placeUpstoxOrderIpv4(orderPayload: any, token: string, retryCount = 0): Promise<any> {
  return new Promise((resolve) => {
    const dataStr = JSON.stringify(orderPayload);
    const agent = getUpstoxAgent();
    const req = https.request(
      "https://api.upstox.com/v2/order/place",
      {
        method: "POST",
        agent,
        family: 4,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Api-Version": "2.0",
          "Content-Length": Buffer.byteLength(dataStr),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", async () => {
          try {
            const json = JSON.parse(raw);
            // If transient network or gateway glitch on first attempt, retry immediately on warm socket
            if (json?.status !== "success" && retryCount === 0 && (raw.includes("ECONNRESET") || raw.includes("socket") || raw.includes("timeout"))) {
              const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
              return resolve(retryRes);
            }
            resolve(json);
          } catch {
            resolve({ status: "error", message: raw });
          }
        });
      },
    );
    req.on("error", async (err) => {
      if (retryCount === 0) {
        const retryRes = await placeUpstoxOrderIpv4(orderPayload, token, 1);
        return resolve(retryRes);
      }
      resolve({ status: "error", message: err?.message || "Network error" });
    });
    req.setTimeout(12000, () => {
      req.destroy();
      resolve({ status: "error", message: "Upstox order request timed out" });
    });
    req.write(dataStr);
    req.end();
  });
}
