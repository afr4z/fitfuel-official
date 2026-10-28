#!/usr/bin/env node
/**
 * End-to-end smoke test for Razorpay Invoices + WhatsApp delivery.
 *
 * 1. Creates a TEST-mode Razorpay invoice.
 * 2. Sends the invoice `short_url` to a WhatsApp number.
 *
 * Usage:
 *   npm run test:invoice -- --phone 918606372462
 *   npm run test:invoice -- --phone 918606372462 --amount 1 --dry-run
 *
 * Flags:
 *   --phone <number>    Recipient in international format (default: TEST_WHATSAPP_PHONE)
 *   --amount <rupees>   Invoice amount in ₹ (default: 1)
 *   --name <name>       Customer name (default: "FitFuel Test")
 *   --email <email>     Customer email (optional)
 *   --expire <minutes>  Invoice expiry, min 15 (default: 60)
 *   --dry-run           Create the invoice but do not send WhatsApp
 *   --allow-live        Allow a live Razorpay key (real money!) — off by default
 *   --help              Show this help
 */

import { createInvoice } from "../lib/razorpay.js";
import { sendText, WhatsAppError } from "../lib/whatsapp.js";

const HELP = `Razorpay invoice + WhatsApp smoke test

  npm run test:invoice -- --phone 918606372462

Flags:
  --phone <number>    Recipient in international format (or TEST_WHATSAPP_PHONE)
  --amount <rupees>   Invoice amount in ₹ (default: 1)
  --name <name>       Customer name (default: "FitFuel Test")
  --email <email>     Customer email (optional)
  --expire <minutes>  Invoice expiry, min 15 (default: 60)
  --dry-run           Create the invoice but do not send WhatsApp
  --allow-live        Allow a live Razorpay key (real money!)
  --help              Show this help
`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--allow-live") args.allowLive = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for --${key}`);
      }
      args[key] = value;
      i++;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return args;
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0"))
    return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return null;
}

function rupees(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatIST(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    fail(`Missing environment variable(s): ${missing.join(", ")}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  requireEnv([
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
  ]);

  const phone = normalizePhone(args.phone || process.env.TEST_WHATSAPP_PHONE);
  if (!phone) {
    fail(
      "Pass a valid recipient with --phone (10-digit Indian number or 91XXXXXXXXXX), " +
        "or set TEST_WHATSAPP_PHONE.",
    );
  }

  const amount = Number(args.amount || 1);
  if (!Number.isFinite(amount) || amount < 1) {
    fail("--amount must be a number ≥ 1 (Razorpay's minimum is ₹1).");
  }

  const expireInMinutes = Number(args.expire || 60);
  if (!Number.isFinite(expireInMinutes) || expireInMinutes < 15) {
    fail("--expire must be at least 15 minutes (Razorpay requirement).");
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const isTestKey = keyId.startsWith("rzp_test_");
  if (!isTestKey && !args.allowLive) {
    fail(
      "RAZORPAY_KEY_ID is not a test key. This script refuses to create real " +
        "invoices unless you pass --allow-live.",
    );
  }

  console.log("\nRazorpay invoice + WhatsApp smoke test");
  console.log(
    `  Key:    ${keyId.slice(0, 12)}… (${isTestKey ? "test" : "LIVE"})`,
  );
  console.log(`  To:     +${phone}`);
  console.log(`  Amount: ${rupees(amount)}`);
  console.log(`  Expiry: ${expireInMinutes} min\n`);

  // ── 1. Create the invoice ────────────────────────────────────────────────
  console.log("[1/2] Creating Razorpay invoice…");
  let invoice;
  try {
    invoice = await createInvoice({
      amount,
      description: `FitFuel test invoice ${new Date().toISOString().slice(0, 10)}`,
      phone,
      name: args.name || "FitFuel Test",
      email: args.email,
      referenceId: `test_${Date.now()}`,
      expireInMinutes,
    });
  } catch (err) {
    fail(`Invoice creation failed: ${err.message}`);
  }

  console.log("      ✓ Invoice created");
  console.log(`        id:        ${invoice.id}`);
  console.log(`        status:    ${invoice.status}`);
  console.log(`        amount:    ${rupees(invoice.amount / 100)}`);
  console.log(`        expires:   ${formatIST(invoice.expire_by)} IST`);
  console.log(`        short_url: ${invoice.short_url}`);

  if (invoice.status !== "issued") {
    console.warn(
      `\n⚠ Invoice status is "${invoice.status}", not "issued". ` +
        "It may not be payable until issued.",
    );
  }

  if (args.dryRun) {
    console.log("\n[2/2] Skipped WhatsApp (--dry-run).");
    console.log("\nDone. Open the short_url above to check the invoice.\n");
    return;
  }

  // ── 2. Send it over WhatsApp ─────────────────────────────────────────────
  console.log("\n[2/2] Sending WhatsApp message…");
  const body = [
    "🧾 *FitFuel test invoice*",
    "",
    `Amount: ${rupees(amount)}`,
    `Invoice: ${invoice.id}`,
    `Expires: ${formatIST(invoice.expire_by)} IST`,
    "",
    `Pay here: ${invoice.short_url}`,
    "",
    isTestKey
      ? "_Razorpay test mode — no real money. Use a test card/UPI to simulate payment._"
      : "_LIVE invoice — this will charge real money._",
  ].join("\n");

  try {
    const sent = await sendText(phone, body);
    const messageId = sent?.messages?.[0]?.id;
    console.log(`      ✓ WhatsApp sent${messageId ? ` (${messageId})` : ""}`);
  } catch (err) {
    if (err instanceof WhatsAppError && err.code === 131047) {
      console.error(
        "\n✗ WhatsApp rejected the free-form message: the 24-hour customer " +
          "service window is closed.",
      );
      console.error(
        '  Ask the recipient to send "hi" to the business number, then rerun. ' +
          "For production you must use an approved template.",
      );
    } else {
      console.error(`\n✗ WhatsApp send failed: ${err.message}`);
    }
    console.error(`\n  The invoice was still created: ${invoice.short_url}\n`);
    process.exit(1);
  }

  console.log("\nDone. Check WhatsApp for the invoice link.\n");
}

main().catch((err) => fail(err.message));
