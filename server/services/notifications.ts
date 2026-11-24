import { botConfig } from "../state";

export async function sendTelegramNotification(message: string) {
  const token = botConfig.telegramBotToken;
  const chatId = botConfig.telegramChatId;
  if (!botConfig.telegramAlertsEnabled || !token || !chatId) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      // Non-blocking log for telegram api error status
    }
  } catch (e: any) {
    // Gracefully handle network timeouts or sandbox egress restrictions without throwing or logging noisy stack traces
    if (e?.name !== "AbortError") {
      // Silently ignore or log cleanly
    }
  }
}
