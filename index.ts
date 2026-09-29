import 'dotenv/config';
import express from 'express';
import { Bot, registerExpressWebhook } from 'node-telegram-bot-api';

const app = express();

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

app.get('/', (_req, res) => {
  res.status(200).send('Moove Telegram Bot is running');
});

// Telegram webhook
registerExpressWebhook(bot, app, {
  path: '/telegram/webhook',
});

// /start command
bot.command('start', async (ctx) => {
  console.log('Received /start command');

  const username = ctx.from?.username;
  const firstName = ctx.from?.first_name || 'there';

  const displayName = username
    ? `@${username}`
    : firstName;

  console.log(`Sending welcome message to ${displayName}`);

  await ctx.reply(
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

  console.log('Welcome message sent');
});

// Button handling
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery?.data;

  console.log(`Button pressed: ${data}`);

  if (data === 'pay_crypto') {
    await ctx.reply(
      '💳 Enter the amount you want to pay.'
    );
  }

  if (data === 'check_payment') {
    await ctx.reply(
      '🔎 Send me your payment link ID and I will check its status.'
    );
  }

  await ctx.answerCallbackQuery();
});

// Catch bot errors
bot.catch((error, ctx) => {
  console.error(
    'Telegram bot error:',
    error,
    'Update:',
    ctx.update
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Moove Telegram Bot running on port ${PORT}`);
});
