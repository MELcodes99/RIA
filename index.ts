import 'dotenv/config';
import express from 'express';
import { Bot } from 'node-telegram-bot-api';

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MOOVE_API_KEY = process.env.MOOVE_API_KEY;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is missing');
}

if (!MOOVE_API_KEY) {
  throw new Error('MOOVE_API_KEY is missing');
}

const bot = new Bot(TELEGRAM_BOT_TOKEN);

console.log('Starting Moove Telegram Bot...');
console.log(`Port: ${PORT}`);

app.get('/', (_req, res) => {
  res.status(200).send('Moove Telegram Bot is running');
});

app.post('/telegram/webhook', async (req, res) => {
  console.log('-----------------------------------');
  console.log('Telegram update received');
  console.log(JSON.stringify(req.body, null, 2));

  try {
    await bot.handleUpdate(req.body);

    console.log('Telegram update handled successfully');

    res.sendStatus(200);
  } catch (error) {
    console.error('Telegram webhook error:', error);

    res.sendStatus(500);
  }
});

bot.on('message', async (msg) => {
  console.log('Message event received');
  console.log(`Chat ID: ${msg.chat.id}`);
  console.log(`Message: ${msg.text}`);

  if (msg.text !== '/start') {
    return;
  }

  const chatId = msg.chat.id;
  const username = msg.from?.username;
  const firstName = msg.from?.first_name || 'there';

  const displayName = username
    ? `@${username}`
    : firstName;

  console.log(`Sending welcome message to ${displayName}`);

  try {
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

    console.log('Welcome message sent successfully');
  } catch (error) {
    console.error('Failed to send welcome message:', error);
  }
});

bot.on('callback_query', async (query) => {
  console.log('Callback query received:', query.data);

  if (!query.message) {
    return;
  }

  const chatId = query.message.chat.id;

  try {
    if (query.data === 'pay_crypto') {
      await bot.sendMessage(
        chatId,
        '💳 Enter the amount you want to pay.'
      );
    }

    if (query.data === 'check_payment') {
      await bot.sendMessage(
        chatId,
        '🔎 Send me your payment link ID and I will check its status.'
      );
    }

    await bot.answerCallbackQuery(query.id);

    console.log('Callback handled successfully');
  } catch (error) {
    console.error('Callback query error:', error);
  }
});

bot.on('polling_error', (error) => {
  console.error('Telegram polling error:', error);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Moove Telegram Bot running on port ${PORT}`);
});
