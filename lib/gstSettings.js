import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function text(value) {
  return String(value ?? "").trim();
}

const PLACEHOLDER_PANS = new Set(["ABCDE1234F", "AAAAA9999A", "AAAPL1234C"]);

export function isValidGstin(value) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(text(value));
}

export function isPlaceholderPan(value) {
  const pan = text(value).toUpperCase();
  return (
    !pan ||
    /^(pending|change[_-]?me|your[_-]?pan|aaaaa|0+)$/i.test(pan) ||
    PLACEHOLDER_PANS.has(pan)
  );
}

export function isPlaceholderGstin(value) {
  const gstin = text(value).toUpperCase();
  const embeddedPan = gstin.slice(2, 12);
  return (
    /^(|pending|change[_-]?me|your[_-]?gstin|aaaaa|0+)$/i.test(gstin) ||
    PLACEHOLDER_PANS.has(embeddedPan)
  );
}

export function normalizeAddressLines(value) {
  if (Array.isArray(value)) {
    return value.map(text).filter(Boolean);
  }
  return String(value ?? "")
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export const DEFAULT_GST_SETTINGS = {
  enabled: false,
  gstin: "",
  legalName: "",
  tradeName: "",
  addressLines: [],
  pan: "",
  email: "",
  phone: "",
  stateCode: "36",
  gstRate: 5,
  sac: "996331",
  deliverySac: "996331",
  prefix: "FF",
  terms: "",
};

export function normalizeGstSettings(row) {
  if (!row) return null;
  const gstin = text(row.seller_gstin).toUpperCase();
  return {
    enabled: Boolean(row.enabled),
    gstin,
    legalName: text(row.seller_legal_name),
    tradeName: text(row.seller_trade_name),
    addressLines: normalizeAddressLines(row.seller_address_lines),
    pan: text(row.seller_pan).toUpperCase(),
    email: text(row.seller_email),
    phone: text(row.seller_phone),
    stateCode:
      text(row.seller_state_code) ||
      (isValidGstin(gstin) ? gstin.slice(0, 2) : ""),
    gstRate: Number(row.gst_rate),
    sac: text(row.sac),
    deliverySac: text(row.delivery_sac),
    prefix: text(row.invoice_prefix),
    terms: text(row.terms),
  };
}

export async function getGstSettings() {
  const { data, error } = await supabase
    .from("gst_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error("[GST] Settings lookup failed:", error.message);
    return null;
  }

  return normalizeGstSettings(data);
}

export function validateGstSettings(input = {}) {
  const enabled = Boolean(input.enabled);
  const gstin = text(input.gstin ?? input.seller_gstin).toUpperCase();
  const legalName = text(input.legalName ?? input.seller_legal_name);
  const tradeName = text(input.tradeName ?? input.seller_trade_name);
  const addressLines = normalizeAddressLines(
    input.addressLines ?? input.seller_address_lines,
  );
  const pan = text(input.pan ?? input.seller_pan).toUpperCase();
  const email = text(input.email ?? input.seller_email);
  const phone = text(input.phone ?? input.seller_phone);
  const gstRate = Number(input.gstRate ?? input.gst_rate ?? 5);
  const sac = text(input.sac) || "996331";
  const deliverySac = text(input.deliverySac ?? input.delivery_sac) || sac;
  const prefix = (
    text(input.prefix ?? input.invoice_prefix) || "FF"
  ).toUpperCase();
  const terms = text(input.terms);

  if (gstin && !isValidGstin(gstin)) {
    throw new Error("Enter a valid 15-character GSTIN");
  }
  if (enabled && (!gstin || isPlaceholderGstin(gstin))) {
    throw new Error("Add a valid GSTIN before enabling GST invoices");
  }
  if (enabled && !legalName) {
    throw new Error("Seller legal name is required to enable GST invoices");
  }
  if (enabled && !addressLines.length) {
    throw new Error("Seller address is required to enable GST invoices");
  }
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    throw new Error("Enter a valid 10-character PAN");
  }
  if (enabled && pan && isPlaceholderPan(pan)) {
    throw new Error("Enter the real seller PAN before enabling GST invoices");
  }
  if (enabled && pan && gstin.slice(2, 12) !== pan) {
    throw new Error("GSTIN does not match the seller PAN");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid seller email");
  }
  if (phone && !/^\+?[0-9][0-9\s-]{7,18}$/.test(phone)) {
    throw new Error("Enter a valid seller phone number");
  }
  if (!Number.isFinite(gstRate) || gstRate <= 0 || gstRate > 50) {
    throw new Error("GST rate must be between 0 and 50%");
  }
  if (!/^[A-Za-z0-9-]{1,12}$/.test(prefix)) {
    throw new Error(
      "Invoice prefix can only use letters, numbers, and hyphens",
    );
  }
  if (!/^\d{4,8}$/.test(sac)) {
    throw new Error("SAC must be 4 to 8 digits");
  }
  if (!/^\d{4,8}$/.test(deliverySac)) {
    throw new Error("Delivery SAC must be 4 to 8 digits");
  }

  return {
    enabled,
    gstin,
    legalName,
    tradeName,
    addressLines,
    pan,
    email,
    phone,
    stateCode: gstin ? gstin.slice(0, 2) : "36",
    gstRate: Math.round(gstRate * 100) / 100,
    sac,
    deliverySac,
    prefix,
    terms,
  };
}

export async function saveGstSettings(input) {
  const settings = validateGstSettings(input);
  const { data, error } = await supabase
    .from("gst_settings")
    .upsert(
      {
        id: true,
        enabled: settings.enabled,
        seller_gstin: settings.gstin,
        seller_legal_name: settings.legalName,
        seller_trade_name: settings.tradeName,
        seller_address_lines: settings.addressLines.join("\n"),
        seller_pan: settings.pan,
        seller_email: settings.email,
        seller_phone: settings.phone,
        seller_state_code: settings.stateCode,
        gst_rate: settings.gstRate,
        sac: settings.sac,
        delivery_sac: settings.deliverySac,
        invoice_prefix: settings.prefix,
        terms: settings.terms,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save GST settings: ${error.message}`);
  }

  return normalizeGstSettings(data);
}
