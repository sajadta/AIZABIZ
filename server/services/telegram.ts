import { botConfig, addBotLog } from '../state';
import { getIstTimeString } from '../utils';

export async function sendTelegramNotification(message: string) {
  if (!botConfig.telegramBotToken || !botConfig.telegramChatId || !botConfig.telegramAlertsEnabled) {
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botConfig.telegramBotToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: botConfig.telegramChatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('[Telegram Error]', errData);
    }
  } catch (err: any) {
    console.error('[Telegram Notification Failed]', err.message);
  }
}
