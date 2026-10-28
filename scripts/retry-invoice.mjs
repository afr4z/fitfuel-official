#!/usr/bin/env node
/**
 * Re-sends an existing GST invoice by Razorpay payment id.
 *
 * Usage:
 *   npm run retry:invoice -- --payment-id pay_xxxxxxxx
 *   npm run retry:invoice -- --invoice FF/2026-27/0001
 *
 * The invoice PDF is regenerated from the stored snapshot when the original
 * storage object is missing.
 */

import { createClient } from "@supabase/supabase-js";
import { resendInvoiceByPaymentId } from "../lib/invoiceService.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    i++;
  }
  return args;
}

const HELP = `Retry a FitFuel GST invoice

  npm run retry:invoice -- --payment-id pay_xxxxxxxx
  npm run retry:invoice -- --invoice FF/2026-27/0001

Flags:
  --payment-id <id>   Razorpay payment id
  --invoice <number>  Invoice number (looked up in Supabase)
  --help              Show this help
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  let paymentId = args["payment-id"];
  if (!paymentId && args.invoice) {
    const { data, error } = await supabase
      .from("invoices")
      .select("razorpay_payment_id")
      .eq("invoice_number", args.invoice)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`No invoice found: ${args.invoice}`);
    paymentId = data.razorpay_payment_id;
  }
  if (!paymentId) {
    throw new Error("Pass --payment-id or --invoice");
  }

  console.log(`Retrying invoice for payment ${paymentId}…`);
  const invoice = await resendInvoiceByPaymentId({ supabase, paymentId });
  console.log(
    `Sent ${invoice.invoice_number} to ${invoice.phone} (${invoice.status})`,
  );
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
