// Tolerant JSON/HTML response parser for the Upstox OTP endpoints.
export async function safeParseJsonResponse(
  res: any,
): Promise<{ data: any; rawText: string; isHtml: boolean }> {
  const rawText = typeof res?.text === "function" ? await res.text().catch(() => "") : "";
  try {
    const data = rawText ? JSON.parse(rawText) : {};
    return { data, rawText, isHtml: false };
  } catch {
    const isHtml = rawText.trim().startsWith("<") || rawText.toLowerCase().includes("cloudflare");
    return { data: {}, rawText, isHtml };
  }
}
