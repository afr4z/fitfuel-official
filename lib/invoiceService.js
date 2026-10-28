import { buildGstInvoicePdf, calculateGstBreakdown } from "./gstInvoice.js";
import {
  DEFAULT_GST_SETTINGS,
  getGstSettings,
  isPlaceholderGstin,
  isValidGstin,
} from "./gstSettings.js";
import { sendDocumentWithTemplateFallback, uploadMedia } from "./whatsapp.js";

const STATE_CODES = {
  "jammu and kashmir": "01",
  "himachal pradesh": "02",
  punjab: "03",
  chandigarh: "04",
  uttarakhand: "05",
  haryana: "06",
  delhi: "07",
  "new delhi": "07",
  rajasthan: "08",
  "uttar pradesh": "09",
  bihar: "10",
  sikkim: "11",
  "arunachal pradesh": "12",
  nagaland: "13",
  manipur: "14",
  mizoram: "15",
  tripura: "16",
  meghalaya: "17",
  assam: "18",
  "west bengal": "19",
  jharkhand: "20",
  odisha: "21",
  orissa: "21",
  chhattisgarh: "22",
  "madhya pradesh": "23",
  gujarat: "24",
  "dadra and nagar haveli": "26",
  "daman and diu": "26",
  maharashtra: "27",
  karnataka: "29",
  goa: "30",
  lakshadweep: "31",
  kerala: "32",
  "tamil nadu": "33",
  puducherry: "34",
  pondicherry: "34",
  "andaman and nicobar islands": "35",
  telangana: "36",
  "andhra pradesh": "37",
  ladakh: "38",
};

const STATE_NAMES = Object.fromEntries(
  Object.entries(STATE_CODES)
    .filter(
      ([name, code]) =>
        name !== "new delhi" && name !== "orissa" && name !== "pondicherry",
    )
    .map(([name, code]) => [code, titleCase(name)]),
);

function titleCase(value) {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

function env(name) {
  return String(process.env[name] ?? "").trim();
}

export async function getInvoiceConfig() {
  const settings = (await getGstSettings()) || DEFAULT_GST_SETTINGS;
  const configured =
    !isPlaceholderGstin(settings.gstin) &&
    isValidGstin(settings.gstin) &&
    Boolean(settings.legalName) &&
    settings.addressLines.length > 0;
  const gstinStateCode = isValidGstin(settings.gstin)
    ? settings.gstin.slice(0, 2)
    : "";
  const parsedRate = Number(settings.gstRate);

  return {
    enabled: Boolean(settings.enabled) && configured,
    requestedEnabled: Boolean(settings.enabled),
    configured,
    sample: env("GST_INVOICE_SAMPLE") === "true",
    prefix: settings.prefix || "FF",
    gstRate: Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 5,
    sac: settings.sac || "996331",
    deliverySac: settings.deliverySac || settings.sac || "996331",
    seller: {
      legalName: settings.legalName,
      tradeName: settings.tradeName,
      addressLines: settings.addressLines,
      gstin: settings.gstin,
      pan: settings.pan,
      email: settings.email,
      phone: settings.phone,
      terms: settings.terms,
    },
    sellerStateCode: settings.stateCode || gstinStateCode || "36",
    bucket: env("INVOICE_STORAGE_BUCKET") || "invoices",
    whatsappTemplate: env("WHATSAPP_INVOICE_TEMPLATE") || "invoice_ready",
  };
}

function financialYear(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function dateIST(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function resolveState(addressText, fallbackCode) {
  const haystack = String(addressText || "").toLowerCase();
  let best = null;
  for (const [name, code] of Object.entries(STATE_CODES)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(
      haystack,
    );
    if (match && (!best || name.length > best.name.length)) {
      best = { name, code };
    }
  }
  if (best) {
    return {
      code: best.code,
      name: STATE_NAMES[best.code] || titleCase(best.name),
    };
  }
  return {
    code: fallbackCode,
    name: STATE_NAMES[fallbackCode] || `State ${fallbackCode}`,
  };
}

function toPaise(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(number * 100);
}

function addressLines(addressText, maxLines = 4) {
  const words = String(addressText || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!words.length) return ["—"];

  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 58 && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length === maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

function invoiceFilename(number) {
  return `FitFuel-GST-Invoice-${String(number).replace(/[^\w-]+/g, "-")}.pdf`;
}

function pdfPathFor(config, number, financialYearValue) {
  return `${financialYearValue}/${invoiceFilename(number).replace(/\.pdf$/i, "")}.pdf`;
}

async function allocateInvoiceNumber(supabase, config, fy) {
  const { data, error } = await supabase.rpc("next_invoice_number", {
    p_financial_year: fy,
  });
  if (error)
    throw new Error(`Invoice number allocation failed: ${error.message}`);
  const sequence = Number(data);
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error("Invoice number allocation returned an invalid sequence");
  }
  return `${config.prefix}/${fy}/${String(sequence).padStart(4, "0")}`;
}

function buildLineItems({ snapshot, amountPaise, config }) {
  const planPaise = toPaise(snapshot.planAmount);
  const deliveryPaise = toPaise(snapshot.deliveryTotal);
  const planTitle = snapshot.planTitle || "FitFuel meal plan";
  const dayLabel = snapshot.dayLabel || "";
  const mealLabel = snapshot.mealLabel || "";
  const planDescription = [planTitle, dayLabel, mealLabel]
    .filter(Boolean)
    .join(" — ");

  const items = [];
  if (planPaise > 0) {
    items.push({
      description: planDescription || "FitFuel meal plan",
      sac: config.sac,
      quantity: 1,
      unitAmount: planPaise,
    });
  }
  if (deliveryPaise > 0) {
    const distance =
      snapshot.distanceKm != null
        ? ` (${Number(snapshot.distanceKm).toFixed(1)} km)`
        : "";
    items.push({
      description: `Delivery charges${distance}`,
      sac: config.deliverySac,
      quantity: 1,
      unitAmount: deliveryPaise,
    });
  }

  if (!items.length) {
    items.push({
      description: planDescription || "FitFuel meal plan",
      sac: config.sac,
      quantity: 1,
      unitAmount: amountPaise,
    });
  }

  // planAmount + deliveryTotal should already equal the paid amount, but
  // paise rounding in the pricing code can leave a 1-paise difference. Absorb
  // it into the delivery line so the invoice total always equals amount paid.
  const itemsTotal = items.reduce(
    (sum, item) =>
      sum + Math.round(Number(item.unitAmount) * (Number(item.quantity) || 1)),
    0,
  );
  const diff = amountPaise - itemsTotal;
  if (diff !== 0) {
    const last = items[items.length - 1];
    const adjusted = last.unitAmount + diff;
    if (items.length > 1 && adjusted > 0) {
      last.unitAmount = adjusted;
    } else if (items[0].unitAmount + diff > 0) {
      items[0].unitAmount += diff;
    } else {
      items.splice(0, items.length, {
        description: planDescription || "FitFuel meal plan",
        sac: config.sac,
        quantity: 1,
        unitAmount: amountPaise,
      });
    }
  }
  return items;
}

function taxFromLineItems(items, gstRate, interState) {
  return items.reduce(
    (acc, item) => {
      const quantity = Number(item.quantity) || 1;
      const lineTotal = Math.round(Number(item.unitAmount) * quantity);
      const tax = calculateGstBreakdown(lineTotal, gstRate, interState);
      acc.amount += lineTotal;
      acc.taxable += tax.taxable;
      acc.cgst += tax.cgst;
      acc.sgst += tax.sgst;
      acc.igst += tax.igst;
      return acc;
    },
    { amount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 },
  );
}

async function buildPdfForInvoice(invoice, config) {
  const seller = invoice.seller_snapshot;
  const buyer = invoice.buyer_snapshot;
  return buildGstInvoicePdf({
    seller,
    buyer,
    invoice: {
      number: invoice.invoice_number,
      date: new Date(`${invoice.invoice_date}T00:00:00+05:30`),
      placeOfSupply: invoice.place_of_supply,
      orderRef: invoice.razorpay_payment_link_id || invoice.subscription_id,
      paymentRef: invoice.razorpay_payment_id,
      sample: config.sample,
      paid: true,
    },
    items: invoice.line_items,
    gstRate: Number(invoice.gst_rate),
    interState: Boolean(invoice.inter_state),
  });
}

async function uploadPdf(supabase, config, invoice, pdf) {
  const path = pdfPathFor(
    config,
    invoice.invoice_number,
    invoice.financial_year,
  );
  const { error } = await supabase.storage
    .from(config.bucket)
    .upload(path, Buffer.from(pdf), {
      contentType: "application/pdf",
      cacheControl: "private, max-age=0",
      upsert: true,
    });
  if (error) throw new Error(`Invoice storage upload failed: ${error.message}`);
  return path;
}

async function downloadPdf(supabase, config, path) {
  const { data, error } = await supabase.storage
    .from(config.bucket)
    .download(path);
  if (error) throw new Error(`Invoice download failed: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

async function deliverInvoice(
  supabase,
  config,
  invoice,
  { force = false } = {},
) {
  if (invoice.status === "sent" && !force) return invoice;

  let pdf;
  if (invoice.pdf_path) {
    try {
      pdf = await downloadPdf(supabase, config, invoice.pdf_path);
    } catch (err) {
      console.warn(
        `[INVOICE] Could not download ${invoice.pdf_path}; regenerating:`,
        err.message,
      );
    }
  }
  if (!pdf) {
    pdf = Buffer.from(await buildPdfForInvoice(invoice, config));
    const path = await uploadPdf(supabase, config, invoice, pdf);
    const { error: pathError } = await supabase
      .from("invoices")
      .update({ pdf_path: path, updated_at: new Date().toISOString() })
      .eq("id", invoice.id);
    if (pathError) {
      console.error("[INVOICE] Failed to save pdf_path:", pathError.message);
    }
    invoice = { ...invoice, pdf_path: path };
  }

  const filename = invoiceFilename(invoice.invoice_number);
  const caption = [
    `FitFuel tax invoice ${invoice.invoice_number}`,
    `Amount paid: ₹${(invoice.amount_paise / 100).toFixed(2)}`,
    "Thank you for choosing FitFuel.",
  ].join("\n");

  try {
    const media = await uploadMedia(pdf, "application/pdf", filename);
    const sent = await sendDocumentWithTemplateFallback(
      invoice.phone,
      { id: media.id, filename, caption },
      config.whatsappTemplate,
    );
    const messageId = sent?.messages?.[0]?.id || null;
    const { data: updated, error } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        whatsapp_message_id: messageId,
        sent_at: new Date().toISOString(),
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id)
      .select("*")
      .single();
    if (error)
      throw new Error(`Invoice sent but DB update failed: ${error.message}`);
    console.log(
      `[INVOICE] Sent ${invoice.invoice_number} to ${invoice.phone}`,
      messageId ? `(${messageId})` : "",
    );
    return updated;
  } catch (err) {
    await supabase
      .from("invoices")
      .update({
        status: "failed",
        error: String(err.message || err).slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);
    throw err;
  }
}

/**
 * Creates, stores and sends a GST invoice for a successful Razorpay payment.
 * Safe to call more than once for the same payment id.
 */
export async function issueInvoiceForPayment({
  supabase,
  subscriptionId,
  paymentId,
  paymentLinkId = null,
  paymentAmountPaise = null,
  paymentCreatedAt = null,
  breakdown = null,
  send = true,
}) {
  const config = await getInvoiceConfig();
  if (!config.enabled) {
    console.log("[INVOICE] Disabled or seller GSTIN not configured; skipping");
    return { status: "disabled" };
  }
  if (!paymentId)
    throw new Error("issueInvoiceForPayment: paymentId is required");

  const { data: existing, error: existingError } = await supabase
    .from("invoices")
    .select("*")
    .eq("razorpay_payment_id", paymentId)
    .maybeSingle();
  if (existingError) {
    throw new Error(`Invoice lookup failed: ${existingError.message}`);
  }
  if (existing) {
    if (existing.status === "sent") return existing;
    return send ? deliverInvoice(supabase, config, existing) : existing;
  }

  const { data: subscription, error: subError } = await supabase
    .from("meal_plan_subscriptions")
    .select("id, customer_id, phone, address_id, payment_breakdown, created_at")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (subError || !subscription) {
    throw new Error(
      `Invoice subscription lookup failed: ${subError?.message || "not found"}`,
    );
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .eq("id", subscription.customer_id)
    .maybeSingle();

  let address = null;
  if (subscription.address_id) {
    const { data } = await supabase
      .from("customer_addresses")
      .select("address, location")
      .eq("id", subscription.address_id)
      .maybeSingle();
    address = data;
  }

  const snapshot = breakdown || subscription.payment_breakdown || {};
  const amountPaise =
    Number(paymentAmountPaise) ||
    toPaise(snapshot.amount) ||
    toPaise(snapshot.totalAmount);
  if (!amountPaise || amountPaise < 100) {
    throw new Error("Invoice amount is missing or less than ₹1");
  }

  const buyerAddress = address?.address || snapshot.address || "";
  const buyerName = customer?.name || snapshot.name || "FitFuel Customer";
  const buyerEmail = customer?.email || snapshot.email || "";
  const state = resolveState(buyerAddress, config.sellerStateCode);
  const interState = state.code !== config.sellerStateCode;
  const date = paymentCreatedAt
    ? new Date(Number(paymentCreatedAt) * 1000)
    : new Date();
  const fy = financialYear(date);
  const lineItems = buildLineItems({ snapshot, amountPaise, config });
  const tax = taxFromLineItems(lineItems, config.gstRate, interState);
  if (tax.amount !== amountPaise) {
    throw new Error(
      `Invoice line items total ${tax.amount} paise but payment is ${amountPaise} paise`,
    );
  }
  const invoiceNumber = await allocateInvoiceNumber(supabase, config, fy);

  const sellerSnapshot = { ...config.seller };
  const buyerSnapshot = {
    name: buyerName,
    phone: subscription.phone,
    email: buyerEmail,
    addressLines: addressLines(buyerAddress),
    gstin: "",
  };

  const draft = {
    invoice_number: invoiceNumber,
    financial_year: fy,
    invoice_date: dateIST(date),
    subscription_id: subscription.id,
    customer_id: subscription.customer_id,
    phone: subscription.phone,
    razorpay_payment_id: paymentId,
    razorpay_payment_link_id: paymentLinkId,
    amount_paise: amountPaise,
    plan_amount_paise: toPaise(snapshot.planAmount),
    delivery_amount_paise: toPaise(snapshot.deliveryTotal),
    gst_rate: config.gstRate,
    taxable_paise: tax.taxable,
    cgst_paise: tax.cgst,
    sgst_paise: tax.sgst,
    igst_paise: tax.igst,
    place_of_supply: `${state.name} (${state.code})`,
    inter_state: interState,
    buyer_name: buyerName,
    buyer_phone: subscription.phone,
    buyer_email: buyerEmail || null,
    buyer_address: buyerAddress || null,
    buyer_gstin: null,
    seller_snapshot: sellerSnapshot,
    buyer_snapshot: buyerSnapshot,
    line_items: lineItems,
    pdf_path: null,
    status: "generated",
  };

  const pdf = await buildPdfForInvoice(draft, config);
  draft.pdf_path = await uploadPdf(supabase, config, draft, pdf);

  const { data: inserted, error: insertError } = await supabase
    .from("invoices")
    .insert(draft)
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced } = await supabase
        .from("invoices")
        .select("*")
        .eq("razorpay_payment_id", paymentId)
        .maybeSingle();
      if (raced) {
        if (raced.status === "sent") return raced;
        return send ? deliverInvoice(supabase, config, raced) : raced;
      }
    }
    throw new Error(`Invoice insert failed: ${insertError.message}`);
  }

  return send ? deliverInvoice(supabase, config, inserted) : inserted;
}

/**
 * Re-sends an existing invoice by Razorpay payment id. Used by the retry script.
 */
export async function resendInvoiceByPaymentId({
  supabase,
  paymentId,
  force = false,
}) {
  const config = await getInvoiceConfig();
  if (!config.enabled) {
    throw new Error(
      "GST invoicing is not enabled or company details are incomplete (Admin → Company)",
    );
  }
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("razorpay_payment_id", paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invoice) throw new Error(`No invoice for payment ${paymentId}`);
  return deliverInvoice(supabase, config, invoice, { force });
}
