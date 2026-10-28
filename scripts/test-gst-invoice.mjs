#!/usr/bin/env node
/**
 * Generates a sample GST tax invoice PDF and sends it over WhatsApp.
 *
 * This is a layout/review harness, not the production flow. It uses
 * placeholder seller details unless GST_SELLER_* env vars are set, and the PDF
 * is watermarked "SAMPLE — NOT A VALID TAX INVOICE".
 *
 * Usage:
 *   npm run test:gst-invoice -- --phone 918606372462
 *   npm run test:gst-invoice -- --phone 918606372462 --amount 1050
 *   npm run test:gst-invoice -- --phone 918606372462 --dry-run
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildGstInvoicePdf } from "../lib/gstInvoice.js";
import { sendDocument, uploadMedia, WhatsAppError } from "../lib/whatsapp.js";

const HELP = `GST invoice PDF + WhatsApp sample

  npm run test:gst-invoice -- --phone 918606372462

Flags:
  --phone <number>    Recipient in international format (or TEST_WHATSAPP_PHONE)
  --amount <rupees>   Invoice total, GST-inclusive (default: 1050)
  --out <path>        PDF output path (default: scripts/out/gst-invoice-sample.pdf)
  --dry-run           Generate the PDF only, do not send WhatsApp
  --help              Show this help
`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--dry-run") args.dryRun = true;
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

function envLines(name, fallback) {
  const raw = process.env[name];
  return raw
    ? raw
        .split("|")
        .map((line) => line.trim())
        .filter(Boolean)
    : fallback;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const phone = normalizePhone(args.phone || process.env.TEST_WHATSAPP_PHONE);
  if (!phone) {
    fail("Pass a recipient with --phone (or set TEST_WHATSAPP_PHONE).");
  }

  const amount = Number(args.amount || 1050);
  if (!Number.isFinite(amount) || amount <= 0) {
    fail("--amount must be a positive number.");
  }

  const gstRate = Number(process.env.GST_RATE || 5);
  const sac = process.env.GST_SAC || "996331";
  // Always watermark test invoices unless GST_INVOICE_SAMPLE=false is set
  // explicitly. A missing GSTIN also forces the sample watermark even if the
  // flag is false, so placeholder sellers can never produce a live-looking PDF.
  const sample =
    process.env.GST_INVOICE_SAMPLE !== "false" || !process.env.GST_SELLER_GSTIN;

  const seller = {
    legalName: process.env.GST_SELLER_LEGAL_NAME || "FitFuel Nutrition",
    tradeName: process.env.GST_SELLER_TRADE_NAME || "",
    addressLines: envLines("GST_SELLER_ADDRESS_LINES", [
      "Sample Address Line 1",
      "Pune, Maharashtra 411001",
    ]),
    gstin: process.env.GST_SELLER_GSTIN || "27AAAAA0000A1Z5",
    email: process.env.GST_SELLER_EMAIL || "hello@fitfuelnutrition.com",
    phone: process.env.GST_SELLER_PHONE || "",
    terms: process.env.GST_INVOICE_TERMS || "",
  };

  const totalPaise = Math.round(amount * 100);
  const invoiceNumber =
    process.env.GST_INVOICE_NUMBER ||
    `FF/2026-27/${String(Date.now()).slice(-4)}`;

  const pdf = await buildGstInvoicePdf({
    seller,
    buyer: {
      name: "FitFuel Test Customer",
      phone,
      email: process.env.TEST_WHATSAPP_EMAIL || "",
      addressLines: ["Sample delivery address", "Pune, Maharashtra 411001"],
    },
    invoice: {
      number: invoiceNumber,
      date: new Date(),
      placeOfSupply: "Maharashtra (27)",
      orderRef: `test_${Date.now()}`,
      paymentRef: "pay_SAMPLE_ONLY",
      sample,
      paid: true,
    },
    items: [
      {
        description: "Meal Plan — 7 Days (Lunch + Dinner) [SAMPLE]",
        sac,
        quantity: 1,
        unitAmount: totalPaise,
      },
    ],
    gstRate,
    interState: false,
  });

  const outPath = path.resolve(
    args.out || path.join(__dirname, "out", "gst-invoice-sample.pdf"),
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, pdf);

  console.log("\nGST invoice sample");
  console.log(`  Seller:  ${seller.legalName}  (${seller.gstin})`);
  console.log(`  Buyer:   FitFuel Test Customer  (+${phone})`);
  console.log(`  Invoice: ${invoiceNumber}`);
  console.log(`  Amount:  ₹${amount.toFixed(2)} incl. ${gstRate}% GST`);
  console.log(`  PDF:     ${outPath}`);
  console.log(`  Size:    ${(pdf.length / 1024).toFixed(1)} KB\n`);

  if (sample) {
    console.log(
      "  ⚠ Placeholder seller details in use (GST_SELLER_GSTIN not set). " +
        "The PDF is watermarked SAMPLE.\n",
    );
  }

  if (args.dryRun) {
    console.log("Dry run — WhatsApp send skipped.\n");
    return;
  }

  if (
    !process.env.WHATSAPP_PHONE_NUMBER_ID ||
    !process.env.WHATSAPP_ACCESS_TOKEN
  ) {
    fail("Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN.");
  }

  console.log("Uploading PDF to WhatsApp…");
  let media;
  try {
    media = await uploadMedia(
      pdf,
      "application/pdf",
      `FitFuel-GST-Invoice-${invoiceNumber.replace(/[^\w-]/g, "-")}.pdf`,
    );
  } catch (err) {
    fail(`Media upload failed: ${err.message}`);
  }
  console.log(`  ✓ Media id: ${media.id}`);

  console.log("Sending document…");
  try {
    const sent = await sendDocument(phone, {
      id: media.id,
      filename: `FitFuel-GST-Invoice-${invoiceNumber.replace(/[^\w-]/g, "-")}.pdf`,
      caption: sample
        ? "Sample GST invoice for layout review — NOT a valid tax invoice."
        : "Your FitFuel GST invoice.",
    });
    console.log(`  ✓ Sent (${sent?.messages?.[0]?.id || "ok"})\n`);
  } catch (err) {
    if (err instanceof WhatsAppError && err.code === 131047) {
      console.error(
        "\n✗ WhatsApp 24-hour window is closed. Ask the recipient to message " +
          "the business number, then rerun.\n",
      );
    } else {
      console.error(`\n✗ WhatsApp send failed: ${err.message}\n`);
    }
    console.error(`  PDF was generated at ${outPath}\n`);
    process.exit(1);
  }
}

main().catch((err) => fail(err.message));
