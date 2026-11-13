// 24x7 anti-sleep keep-alive engine for Render deployments.
export function startWakeupEngine(port: number) {
  async function executeRenderWakeupPing() {
    const targets = Array.from(
      new Set(
        [
          process.env.RENDER_EXTERNAL_URL,
          "https://aizabiz.onrender.com",
          process.env.UPSTOX_REDIRECT_URI || "",
          `http://127.0.0.1:${port}`,
        ].filter(Boolean) as string[],
      ),
    );

    for (const base of targets) {
      try {
        const cleanBase = base.replace(/\/+$/, "");
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        await fetch(`${cleanBase}/api/ping?t=${Date.now()}`, {
          signal: ctrl.signal,
          headers: {
            "User-Agent": "AIZABIZ-24x7-Render-Wakeup-Engine/1.0",
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
        });
        clearTimeout(timer);
      } catch (err) {
        // Ignore unreachable secondary URLs quietly
      }
    }
  }

  // Run initial wakeup ping 15 seconds after boot, then every 5 minutes (300,000 ms)
  setTimeout(executeRenderWakeupPing, 15 * 1000);
  setInterval(executeRenderWakeupPing, 5 * 60 * 1000);
}
