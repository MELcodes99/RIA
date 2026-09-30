import "dotenv/config";
import express from "express";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MOOVE_API_KEY = process.env.MOOVE_API_KEY;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is missing");
}

if (!MOOVE_API_KEY) {
  throw new Error("MOOVE_API_KEY is missing");
}

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const awaitingAmount = new Set<number>();

async function telegram(
  method: string,
  body: Record<string, unknown>
) {
  const response = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  console.log(`Telegram ${method}:`, JSON.stringify(data));

  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram API error: ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function createMoovePaymentLink(amount: string) {
  const response = await fetch(
    "https://api.moove.xyz/v1/payment-link",
    {
      method: "POST",
      headers: {
        "X-API-Key": MOOVE_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        toAmount: amount,
        description: "RIA Telegram payment",
        maxUsage: 1,
      }),
    }
  );

  const data = await response.json();

  console.log(
    "Moove payment-link response:",
    JSON.stringify(data)
  );

  if (!response.ok) {
    throw new Error(
      `Moove API error: ${JSON.stringify(data)}`
    );
  }

  return data;
}

app.get("/", (_req, res) => {
  res.status(200).send("Moove Telegram Bot is running");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "moove-telegram-bot",
  });
});

app.post("/telegram/webhook", async (req, res) => {
  console.log("=================================");
  console.log("TELEGRAM UPDATE RECEIVED");
  console.log(JSON.stringify(req.body, null, 2));

  res.sendStatus(200);

  try {
    const update = req.body;

    if (update.message) {
      const message = update.message;

      const chatId = message.chat?.id;
      const text = message.text?.trim();

      if (!chatId || !text) {
        return;
      }

      console.log("Chat ID:", chatId);
      console.log("Message:", text);

      if (text === "/start") {
        awaitingAmount.delete(chatId);

        const username = message.from?.username;
        const firstName = message.from?.first_name || "there";

        const displayName = username
          ? `@${username}`
          : firstName;

        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            `Welcome, ${displayName} 👋🏽\n\n` +
            `What would you like to do?`,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "💳 Pay with Crypto",
                  callback_data: "pay_crypto",
                },
              ],
              [
                {
                  text: "🔎 Check Payment",
                  callback_data: "check_payment",
                },
              ],
            ],
          },
        });

        return;
      }

      if (awaitingAmount.has(chatId)) {
        const amount = Number(text);

        if (!Number.isFinite(amount) || amount <= 0) {
          await telegram("sendMessage", {
            chat_id: chatId,
            text: "Please enter a valid USD amount, for example: 50",
          });

          return;
        }

        awaitingAmount.delete(chatId);

        await telegram("sendMessage", {
          chat_id: chatId,
          text: `Creating your $${amount.toFixed(2)} USDC payment link...`,
        });

        const payment = await createMoovePaymentLink(
          amount.toFixed(2)
        );

        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            `💳 Payment Ready\n\n` +
            `Amount: $${amount.toFixed(2)} USDC\n\n` +
            `Tap below to pay.`,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `Pay $${amount.toFixed(2)} USDC`,
                  url: payment.url,
                },
              ],
            ],
          },
        });

        return;
      }

      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "Please choose an option from the menu or type /start.",
      });

      return;
    }

    if (update.callback_query) {
      const callback = update.callback_query;

      const chatId = callback.message?.chat?.id;
      const callbackData = callback.data;

      console.log("Button:", callbackData);
      console.log("Chat ID:", chatId);

      await telegram("answerCallbackQuery", {
        callback_query_id: callback.id,
      });

      if (!chatId) {
        return;
      }

      if (callbackData === "pay_crypto") {
        awaitingAmount.add(chatId);

        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            "💳 Pay with Crypto\n\n" +
            "Enter the amount in USD.\n\n" +
            "Example: 50",
        });

        return;
      }

      if (callbackData === "check_payment") {
        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            "🔎 Check Payment\n\n" +
            "Payment checking will be added next.",
        });

        return;
      }
    }
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log(`Moove Telegram Bot running on port ${PORT}`);
  console.log("=================================");
});
