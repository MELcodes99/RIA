import 'dotenv/config';
import { Bot } from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is missing from .env');
}

const bot = new Bot(token);

console.log('Moove Telegram bot is starting...');

bot.on('message', async (msg) => {
  if (msg.text !== '/start') {
    return;
  }

  const chatId = msg.chat.id;

  const username = msg.from?.username;
  const firstName = msg.from?.first_name || 'there';

  const displayName = username
    ? `@${username}`
    : firstName;

  await bot.sendMessage(
    chatId,
    `Welcome, ${displayName} 👋🏽\n\nWhat would you like to do?`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '💳 Pay with Crypto',
              callback_data: 'pay_crypto',
            },
          ],
          [
            {
              text: '🔎 Check Payment',
              callback_data: 'check_payment',
            },
          ],
        ],
      },
    }
  );
});

bot.startPolling();

console.log('Moove Telegram bot is running...');
