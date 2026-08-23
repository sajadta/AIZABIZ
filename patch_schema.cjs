const fs = require('fs');
let code = fs.readFileSync('src/db/schema.ts', 'utf8');

code = code.replace("upstoxAccessToken: text('upstox_access_token'),", "upstoxAccessToken: text('upstox_access_token'),\n  botConfig: text('bot_config'),\n  telegramToken: text('telegram_token'),\n  telegramChatId: text('telegram_chat_id'),");

fs.writeFileSync('src/db/schema.ts', code);
console.log('Schema patched');
