# RIA

RIA is a Telegram-native payment link generator powered by Moove.

It allows users to connect their own Moove API key, create crypto payment 
links directly from Telegram, and copy or forward those links to their 
customers.

RIA is designed to make accepting crypto payments simpler without 
requiring users to build or manage their own payment infrastructure.

## How it works

```text
Telegram User
     ↓
RIA Telegram Bot
     ↓
Connect Moove Account
     ↓
Moove API
     ↓
Create Payment Link
     ↓
Copy / Forward Link
     ↓
Customer Pays
```

Each RIA user connects their own Moove API key.

This means payment links are created using the connected user's Moove 
account rather than a single account shared by every RIA user.

## Using RIA

Start the bot and send:

```text
/start
```

RIA will ask you to connect your Moove account.

### 1. Connect Moove

Select:

```text
🔗 Connect Moove
```

RIA will ask for your Moove API key.

Send the API key as your next message.

RIA immediately attempts to delete the message containing the API key from 
the Telegram chat and validates the key with Moove.

If the key is valid, your Moove account is connected.

> Never share your Moove API key with anyone other than the application 
you intend to authorize.

### 2. Create a payment

Select:

```text
💳 Create Payment
```

Enter the amount you want to receive.

For example:

```text
50
```

RIA creates a Moove payment link using your connected Moove account.

### 3. Copy and share the payment link

RIA returns the payment link directly in the Telegram chat.

Example:

```text
💳 Payment Link Ready

Amount: $50.00 USDC

https://moove.xyz/...

Copy the link and send it to your customer.
```

You can copy the link and send it anywhere you want.

RIA also provides an `Open Payment Page` button for convenience.

## Features

* Telegram-native payment experience
* Connect your own Moove account
* Per-user Moove API credentials
* Create crypto payment links
* Specify payment amount
* Copy payment links directly from Telegram
* Forward payment links to customers
* Disconnect your Moove account
* Telegram webhook architecture
* Hosted on Render
* Built with TypeScript and Express

## Architecture

RIA uses a simple webhook architecture:

```text
Telegram
   │
   │ Telegram Bot API
   ▼
Render
   │
   │ RIA application
   ▼
Moove API
   │
   │ Payment Link
   ▼
Customer
```

The Telegram bot receives updates through a webhook rather than 
continuously polling Telegram.

## Tech Stack

* TypeScript
* Node.js
* Express
* Telegram Bot API
* Moove API
* Render
* GitHub

## Environment Variables

RIA requires the Telegram bot token.

Create a `.env` file locally:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

Do not commit `.env` or API credentials to GitHub.

For production, environment variables should be configured through your 
hosting provider.

## Local Development

Clone the repository:

```bash
git clone https://github.com/MELcodes99/RIA.git
cd RIA
```

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
nano .env
```

Add:

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

Start the application:

```bash
npm run start
```

The local server will run on the configured port.

## Deployment

RIA is designed to run as a webhook-based service.

The production webhook points Telegram to:

```text
/telegram/webhook
```

The application exposes a health endpoint:

```text
/health
```

A successful health response looks like:

```json
{
  "status": "ok",
  "service": "moove-telegram-bot"
}
```

## Security

RIA does not print incoming Telegram messages or Moove API keys to 
application logs.

When a user sends their Moove API key, RIA attempts to delete the Telegram 
message containing the key immediately after receiving it.

API keys should never be committed to GitHub.

### Current credential storage

The current MVP keeps connected Moove credentials in application memory.

This means users may need to reconnect their Moove account after an 
application restart or redeployment.

Persistent encrypted credential storage is planned for the production 
version.

## Current Payment Model

RIA currently uses Moove's payment-link API.

Payment amounts are currently handled as USD-denominated USDC payment 
links based on the connected Moove account configuration.

RIA does not currently provide direct fiat payout functionality through 
its own API layer.

## Roadmap

### Phase 1 — MVP

* [x] Telegram bot
* [x] Telegram webhook
* [x] Moove API integration
* [x] Per-user Moove connections
* [x] API key validation
* [x] API-key message deletion
* [x] Payment link generation
* [x] Copyable payment links
* [x] Payment link sharing

### Phase 2 — Production Infrastructure

* [ ] Persistent database
* [ ] Encrypted credential storage
* [ ] Payment history
* [ ] Payment status tracking
* [ ] Moove webhook integration
* [ ] Automatic payment confirmations
* [ ] Credential rotation and revocation
* [ ] Rate limiting
* [ ] Improved monitoring

### Phase 3 — Platform

* [ ] Merchant profiles
* [ ] Payment analytics
* [ ] Payment receipts
* [ ] Multiple payment options
* [ ] Merchant dashboard
* [ ] Additional Moove functionality as APIs become available

## Why RIA?

Crypto payments can already work, but the experience is often fragmented.

RIA focuses on one simple interaction:

```text
Create payment
→ Get link
→ Send link
→ Get paid
```

The goal is to make crypto payment collection accessible from a tool 
people already use every day: Telegram.

## Status

RIA is currently an early-stage MVP.

The core multi-user payment-link flow is live and functional. The next 
stage is improving persistence, payment tracking, security, and 
reliability before scaling to more users.

## License

This project is currently under active development.

