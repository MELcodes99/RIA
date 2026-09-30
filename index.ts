import "dotenv/config";
import express from "express";

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is missing");
}

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Temporary in-memory storage.
// We will move this to persistent encrypted storage next.
const userMooveKeys = new Map<number, string>();

const awaitingAmount = new Set<number>();
const awaitingMooveKey = new Set<number>();

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

  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram API error: ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function validateMooveApiKey(apiKey: string) {
  const response = await fetch(
    "https://api.moove.xyz/v1/payment-link",
    {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
      },
    }
  );

  const data = await response.json();

  return {
    valid: response.ok,
    data,
  };
}

async function createMoovePaymentLink(
  apiKey: string,
  amount: string
) {
  const response = await fetch(
    "https://api.moove.xyz/v1/payment-link",
    {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
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

  if (!response.ok) {
    throw new Error(
      `Moove API error: ${JSON.stringify(data)}`
    );
  }

  return data;
}

app.get("/", (_req, res) => {
  res.status(200).send("RIA Telegram Bot is running");
});

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "moove-telegram-bot",
  });
});

app.post("/telegram/webhook", async (req, res) => {
  // Always acknowledge Telegram immediately.
  res.sendStatus(200);

  try {
    const update = req.body;

    /*
     * ==============================
     * NORMAL TELEGRAM MESSAGE
     * ==============================
     */

    if (update.message) {
      const message = update.message;

      const chatId = message.chat?.id;
      const text = message.text?.trim();

      if (!chatId || !text) {
        return;
      }

      /*
       * IMPORTANT:
       * Do NOT log the Telegram message here.
       * Users may send sensitive API keys.
       */

      /*
       * ==============================
       * /start
       * ==============================
       */

      if (text === "/start") {
        awaitingAmount.delete(chatId);
        awaitingMooveKey.delete(chatId);

        const username = message.from?.username;
        const firstName =
          message.from?.first_name || "there";

        const displayName = username
          ? `@${username}`
          : firstName;

        const connected = userMooveKeys.has(chatId);

        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            `Welcome, ${displayName} 👋🏽\n\n` +
            `RIA helps you create Moove payment links directly from Telegram.\n\n` +
            (connected
              ? "✓ Your Moove account is connected."
              : "Connect your Moove account to get started."),
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: connected
                    ? "💳 Create Payment"
                    : "🔗 Connect Moove",
                  callback_data: connected
                    ? "pay_crypto"
                    : "connect_moove",
                },
              ],
              ...(connected
                ? [
                    [
                      {
                        text: "🔗 Moove Account",
                        callback_data: "moove_account",
                      },
                    ],
                    [
                      {
                        text: "❌ Disconnect Moove",
                        callback_data: "disconnect_moove",
                      },
                    ],
                  ]
                : []),
            ],
          },
        });

        return;
      }

      /*
       * ==============================
       * API KEY INPUT
       * ==============================
       */

      if (awaitingMooveKey.has(chatId)) {
        // Stop accepting API-key input immediately.
        awaitingMooveKey.delete(chatId);

        const apiKey = text.trim();

        /*
         * Delete the user's API-key message
         * immediately from the Telegram chat.
         */
        try {
          await telegram("deleteMessage", {
            chat_id: chatId,
            message_id: message.message_id,
          });
        } catch (deleteError) {
          console.error(
            "Could not delete API key message:",
            deleteError
          );
        }

        /*
         * Tell the user we're checking it.
         */
        await telegram("sendMessage", {
          chat_id: chatId,
          text: "🔐 Checking your Moove API key...",
        });

        /*
         * Validate against Moove.
         */
        const validation =
          await validateMooveApiKey(apiKey);

        if (!validation.valid) {
          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              "❌ That Moove API key could not be verified.\n\n" +
              "Please check the key and try connecting again.",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔗 Try Again",
                    callback_data: "connect_moove",
                  },
                ],
              ],
            },
          });

          return;
        }

        /*
         * Store the key for this Telegram user.
         */
        userMooveKeys.set(chatId, apiKey);

        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            "✅ Moove connected successfully.\n\n" +
            "Your payment links will now be created using your connected Moove account.",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "💳 Create Payment",
                  callback_data: "pay_crypto",
                },
              ],
              [
                {
                  text: "❌ Disconnect Moove",
                  callback_data: "disconnect_moove",
                },
              ],
            ],
          },
        });

        return;
      }

      /*
       * ==============================
       * PAYMENT AMOUNT INPUT
       * ==============================
       */

      if (awaitingAmount.has(chatId)) {
        const amount = Number(text);

        if (!Number.isFinite(amount) || amount <= 0) {
          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              "Please enter a valid USD amount.\n\n" +
              "Example: 50",
          });

          return;
        }

        const userMooveKey = userMooveKeys.get(chatId);

        if (!userMooveKey) {
          awaitingAmount.delete(chatId);

          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              "Your Moove account is not connected.\n\n" +
              "Please connect your Moove account first.",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔗 Connect Moove",
                    callback_data: "connect_moove",
                  },
                ],
              ],
            },
          });

          return;
        }

        awaitingAmount.delete(chatId);

        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            `Creating your $${amount.toFixed(2)} USDC payment link...`,
        });

        try {
          const payment =
            await createMoovePaymentLink(
              userMooveKey,
              amount.toFixed(2)
            );

          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              `💳 Payment Link Ready\n\n` +
              `Amount: $${amount.toFixed(2)} USDC\n\n` +
              `${payment.url}\n\n` +
              `Copy the link and send it to your customer.`,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: `Open Payment Page`,
                    url: payment.url,
                  },
                ],
              ],
            },
          });
        } catch (error) {
          console.error(
            "Payment creation failed:",
            error
          );

          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              "❌ I couldn't create the payment link.\n\n" +
              "Your Moove connection may no longer be valid. Please reconnect your account.",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔗 Reconnect Moove",
                    callback_data: "connect_moove",
                  },
                ],
              ],
            },
          });
        }

        return;
      }

      /*
       * ==============================
       * UNKNOWN MESSAGE
       * ==============================
       */

      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          "Please choose an option from the menu or type /start.",
      });

      return;
    }

    /*
     * ==============================
     * CALLBACK QUERY / BUTTONS
     * ==============================
     */

    if (update.callback_query) {
      const callback = update.callback_query;

      const chatId =
        callback.message?.chat?.id;

      const callbackData = callback.data;

      await telegram("answerCallbackQuery", {
        callback_query_id: callback.id,
      });

      if (!chatId) {
        return;
      }

      /*
       * CONNECT MOOVE
       */

      if (callbackData === "connect_moove") {
        awaitingAmount.delete(chatId);
        awaitingMooveKey.add(chatId);

        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            "🔗 Connect your Moove account\n\n" +
            "Send your Moove API key in your next message.\n\n" +
            "Your API-key message will be deleted immediately after it is received.",
        });

        return;
      }

      /*
       * CREATE PAYMENT
       */

      if (callbackData === "pay_crypto") {
        const connected =
          userMooveKeys.has(chatId);

        if (!connected) {
          await telegram("sendMessage", {
            chat_id: chatId,
            text:
              "You need to connect your Moove account first.",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔗 Connect Moove",
                    callback_data: "connect_moove",
                  },
                ],
              ],
            },
          });

          return;
        }

        awaitingAmount.add(chatId);

        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            "💳 Create Payment\n\n" +
            "Enter the amount in USD.\n\n" +
            "Example: 50",
        });

        return;
      }

      /*
       * MOOVE ACCOUNT
       */

      if (callbackData === "moove_account") {
        const connected =
          userMooveKeys.has(chatId);

        await telegram("sendMessage", {
          chat_id: chatId,
          text: connected
            ? "✓ Your Moove account is connected."
            : "No Moove account is connected.",
        });

        return;
      }

      /*
       * DISCONNECT MOOVE
       */

      if (callbackData === "disconnect_moove") {
        userMooveKeys.delete(chatId);
        awaitingAmount.delete(chatId);
        awaitingMooveKey.delete(chatId);

        await telegram("sendMessage", {
          chat_id: chatId,
          text:
            "✓ Your Moove connection has been removed from RIA.",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔗 Connect Moove",
                  callback_data: "connect_moove",
                },
              ],
            ],
          },
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
  console.log(
    `RIA Telegram Bot running on port ${PORT}`
  );
  console.log("=================================");
});
