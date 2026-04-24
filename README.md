# WhatsApp Bot — Vercel Serverless

A minimal WhatsApp Cloud API webhook backend deployable to Vercel in minutes.

## File Structure

```
whatsapp-bot-vercel/
├── api/
│   └── webhook.js      ← The only file you need to edit for bot logic
├── .env.local          ← Your secrets (never commit this)
├── vercel.json
└── package.json
```

## Setup

### 1. Fill in .env.local

```
WHATSAPP_PHONE_NUMBER_ID=   # From Meta App Dashboard → WhatsApp → API Setup
WHATSAPP_ACCESS_TOKEN=      # Permanent system user token
WHATSAPP_VERIFY_TOKEN=      # Any string you choose (e.g. "mysecret123")
```

### 2. Deploy to Vercel

```bash
npm i -g vercel
vercel deploy
```

Copy the deployment URL, e.g. `https://your-app.vercel.app`

### 3. Add env vars in Vercel Dashboard

Go to your project → Settings → Environment Variables  
Add all three vars from `.env.local`

### 4. Register Webhook in Meta Dashboard

App Dashboard → WhatsApp → Configuration → Edit

- **Callback URL**: `https://your-app.vercel.app/api/webhook`
- **Verify Token**: same value as `WHATSAPP_VERIFY_TOKEN`

Click **Verify and Save**.

Then subscribe to the **messages** webhook field.

### 5. Test it

Send a WhatsApp message to your test number.  
Check Vercel → Functions → Logs to see it arrive.

## Bot Logic

Edit the `handleIncomingMessage` function in `api/webhook.js`:

```js
async function handleIncomingMessage(from, messageText, messageId) {
  await markAsRead(messageId);

  // Your logic here — call Claude, query a DB, anything
  const reply = await yourBotLogic(messageText);

  await sendMessage(from, reply);
}
```

## Local Development

```bash
npm install
vercel dev
# Use ngrok to expose localhost:3000 → register that URL as webhook
ngrok http 3000
```
