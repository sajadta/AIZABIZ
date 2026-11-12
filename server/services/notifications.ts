import { botConfig } from "../state";

export async function sendTelegramNotification(message: string) {
  const token = botConfig.telegramBotToken;
  const chatId = botConfig.telegramChatId;
  if (!botConfig.telegramAlertsEnabled || !token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (e) {
    console.error("Failed to send telegram notification:", e);
  }
}
