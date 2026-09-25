import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendText, sendTemplate } from "../lib/whatsapp.js";
import { sendNotification } from "../lib/sendNotification.js";
import { safeEqualStrings } from "../lib/timingSafe.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const OTP_TTL_SECONDS = 300;
const SESSION_TTL_DAYS = 14;
// The nav calls /me on every page view, so the sliding TTL was re-asserted
// on every request — a Redis write per page view, to extend a 14-day
// session. Refreshing at most hourly keeps the sliding behaviour for any
// real user while collapsing steady-state writes to zero.
const SESSION_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_DAILY_LIMIT = 5;
const OTP_MAX_ATTEMPTS = 5;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_HEADERS = {
  Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
};

function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

async function storeOTP(phone, otp) {
  const key = `otp:${phone}`;
  const data = JSON.stringify({ otp, createdAt: Date.now() });
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
    body: data,
  });
  await fetch(
    `${process.env.UPSTASH_REDIS_REST_URL}/expire/${key}/${OTP_TTL_SECONDS}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      },
    },
  );
}

async function getOTP(phone) {
  const key = `otp:${phone}`;
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function deleteOTP(phone) {
  const key = `otp:${phone}`;
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/del/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });
}

// ── OTP throttling (cooldown, daily cap, attempt lockout) ────────────────

async function setOTPCooldown(phone) {
  const key = `otp_cd:${phone}`;
  await fetch(`${UPSTASH_URL}/set/${key}`, {
    method: "POST",
    headers: UPSTASH_HEADERS,
    body: "1",
  });
  await fetch(`${UPSTASH_URL}/expire/${key}/${OTP_COOLDOWN_SECONDS}`, {
    method: "POST",
    headers: UPSTASH_HEADERS,
  });
}

/** Seconds remaining on the per-phone resend cooldown (0 = none). */
async function getOTPCooldownRemaining(phone) {
  const key = `otp_cd:${phone}`;
  const res = await fetch(`${UPSTASH_URL}/ttl/${key}`, {
    headers: UPSTASH_HEADERS,
  });
  const data = await res.json();
  return typeof data.result === "number" && data.result > 0 ? data.result : 0;
}

/** Increment the per-phone daily send counter (IST day); returns new count. */
async function incrDailyOTP(phone) {
  const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const key = `otp_day:${phone}:${istDate}`;
  const res = await fetch(`${UPSTASH_URL}/incr/${key}`, {
    method: "POST",
    headers: UPSTASH_HEADERS,
  });
  const data = await res.json();
  const count = Number(data.result ?? 0);
  if (count === 1) {
    await fetch(`${UPSTASH_URL}/expire/${key}/86400`, {
      method: "POST",
      headers: UPSTASH_HEADERS,
    });
  }
  return count;
}

async function resetOTPAttempts(phone) {
  await fetch(`${UPSTASH_URL}/del/otp_att:${phone}`, {
    method: "POST",
    headers: UPSTASH_HEADERS,
  });
}

/** Increment the verify-attempt counter; returns new count. */
async function incrOTPAttempts(phone) {
  const key = `otp_att:${phone}`;
  const res = await fetch(`${UPSTASH_URL}/incr/${key}`, {
    method: "POST",
    headers: UPSTASH_HEADERS,
  });
  const data = await res.json();
  const count = Number(data.result ?? 0);
  if (count === 1) {
    await fetch(`${UPSTASH_URL}/expire/${key}/${OTP_TTL_SECONDS}`, {
      method: "POST",
      headers: UPSTASH_HEADERS,
    });
  }
  return count;
}

async function getMagicToken(token) {
  const key = `magic:${token}`;
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function getMagicTokenByRef(referenceId) {
  const key = `magic_ref:${referenceId}`;
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });
  const data = await res.json();
  if (!data.result) return null;
  const { token } = JSON.parse(data.result);
  const magic = await getMagicToken(token);
  if (!magic) return null;
  return { ...magic, token };
}

async function deleteMagicToken(token) {
  const key = `magic:${token}`;
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/del/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });
}

async function deleteMagicTokenByRef(referenceId) {
  const key = `magic_ref:${referenceId}`;
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/del/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });
}

function createSessionToken() {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * SET with a TTL in a single command. Upstash's body-style REST form takes
 * the whole command as a JSON array, which also sidesteps URL-encoding the
 * value. One round trip instead of SET followed by EXPIRE.
 */
async function redisSetWithTTL(key, value, ttlSeconds) {
  await fetch(UPSTASH_URL, {
    method: "POST",
    headers: { ...UPSTASH_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(["SET", key, value, "EX", ttlSeconds]),
  });
}

async function storeSession(token, phone) {
  const key = `session:${token}`;
  const data = JSON.stringify({ phone, createdAt: Date.now() });
  await redisSetWithTTL(key, data, SESSION_TTL_DAYS * 86400);
}

async function getSession(token) {
  const key = `session:${token}`;
  const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function deleteSession(token) {
  const key = `session:${token}`;
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/del/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });
}

/**
 * Re-assert the sliding TTL. This rewrites the record rather than issuing a
 * bare EXPIRE, so createdAt moves forward — which is what lets handleMe
 * throttle the write to at most one per interval instead of one per request.
 */
async function refreshSession(token, phone) {
  const key = `session:${token}`;
  const data = JSON.stringify({ phone, createdAt: Date.now() });
  await redisSetWithTTL(key, data, SESSION_TTL_DAYS * 86400);
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_DAYS * 86400}`,
  );
}

async function getCustomerByPhone(phone) {
  const { data } = await supabase
    .from("customers")
    .select("id, name, email")
    .eq("phone", phone)
    .single();
  return data;
}

async function getActiveSubscriptions(phone) {
  const { data } = await supabase
    .from("meal_plan_subscriptions")
    .select(
      `
      id, plan_type, status, start_date, end_date, meal_plan_id,
      meal_plans (name, emoji, tag)
    `,
    )
    .eq("phone", phone)
    .eq("status", "active")
    .gte("end_date", new Date().toISOString().split("T")[0])
    .order("end_date", { ascending: true });
  return data || [];
}

async function getUpcomingMeals(phone) {
  const { data: subs } = await supabase
    .from("meal_plan_subscriptions")
    .select("id")
    .eq("phone", phone)
    .eq("status", "active")
    .gte("end_date", new Date().toISOString().split("T")[0]);

  if (!subs?.length) return [];

  const subIds = subs.map((s) => s.id);
  const { data: orders } = await supabase
    .from("orders")
    .select(
      `
      id, delivery_date, slot, status, item_name,
      subscription_slots!inner(subscription_id)
    `,
    )
    .in("subscription_slots.subscription_id", subIds)
    .gte("delivery_date", new Date().toISOString().split("T")[0])
    .order("delivery_date", { ascending: true })
    .limit(10);

  return orders || [];
}

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.searchParams.get("path") || url.pathname;
  console.log("[AUTH] Handler:", {
    method: req.method,
    path,
    pathname: url.pathname,
  });

  if (
    req.method === "POST" &&
    (path === "/api/auth/send-otp" || path === "send-otp")
  ) {
    return handleSendOTP(req, res);
  }

  if (
    req.method === "POST" &&
    (path === "/api/auth/verify-otp" || path === "verify-otp")
  ) {
    return handleVerifyOTP(req, res);
  }

  if (
    req.method === "POST" &&
    (path === "/api/auth/magic-login" || path === "magic-login")
  ) {
    return handleMagicLogin(req, res);
  }

  if (
    req.method === "GET" &&
    (path === "/api/auth/magic-login" || path === "magic-login")
  ) {
    return handleMagicLoginByRef(req, res, url);
  }

  if (
    req.method === "POST" &&
    (path === "/api/auth/logout" || path === "logout")
  ) {
    return handleLogout(req, res);
  }

  if (req.method === "GET" && (path === "/api/auth/me" || path === "me")) {
    return handleMe(req, res);
  }

  if (req.method === "PATCH" && (path === "/api/auth/me" || path === "me")) {
    return handleUpdateProfile(req, res);
  }

  if (
    req.method === "POST" &&
    (path === "/api/auth/addresses" || path === "addresses")
  ) {
    return handleAddAddress(req, res);
  }

  if (
    req.method === "PATCH" &&
    (path.startsWith("/api/auth/addresses/") || path.startsWith("addresses/"))
  ) {
    return handleUpdateAddress(req, res, path);
  }

  if (
    req.method === "DELETE" &&
    (path.startsWith("/api/auth/addresses/") || path.startsWith("addresses/"))
  ) {
    return handleDeleteAddress(req, res, path);
  }

  return res.status(404).json({ error: "Not found" });
}

async function handleMagicLoginByRef(req, res, url) {
  const referenceId = url.searchParams.get("reference_id");
  if (!referenceId) {
    return res.status(400).json({ error: "Missing reference_id" });
  }

  const magic = await getMagicTokenByRef(referenceId);
  if (!magic) {
    return res.status(401).json({ error: "Token expired or invalid" });
  }

  await deleteMagicToken(magic.token || ""); // cleanup: remove magic:{token}
  await deleteMagicTokenByRef(referenceId);

  const sessionToken = createSessionToken();
  await storeSession(sessionToken, magic.phone);

  setSessionCookie(res, sessionToken);
  return res.status(200).json({ success: true, phone: magic.phone });
}

async function handleMagicLogin(req, res) {
  const { token } = req.body || {};
  if (!token || !token.startsWith("magic_")) {
    return res.status(400).json({ error: "Invalid token" });
  }

  const magic = await getMagicToken(token);
  if (!magic) {
    return res.status(401).json({ error: "Token expired or invalid" });
  }

  await deleteMagicToken(token);

  const sessionToken = createSessionToken();
  await storeSession(sessionToken, magic.phone);

  setSessionCookie(res, sessionToken);
  return res.status(200).json({
    success: true,
    phone: magic.phone,
    referenceId: magic.referenceId,
  });
}

async function handleSendOTP(req, res) {
  const { phone } = req.body || {};
  const cleanPhone = phone?.replace(/\D/g, "");

  if (!cleanPhone || !/^[0-9]{10}$/.test(cleanPhone)) {
    return res
      .status(400)
      .json({ error: "Invalid phone number (10 digits required)" });
  }

  // Throttle: one OTP per phone per 60s cooldown window.
  const cooldownLeft = await getOTPCooldownRemaining(cleanPhone);
  if (cooldownLeft > 0) {
    res.setHeader("Retry-After", String(cooldownLeft));
    return res
      .status(429)
      .json({ error: "Too many OTP requests. Please wait and try again." });
  }

  // Throttle: at most OTP_DAILY_LIMIT OTPs per phone per IST day.
  const dayCount = await incrDailyOTP(cleanPhone);
  if (dayCount > OTP_DAILY_LIMIT) {
    return res
      .status(429)
      .json({ error: "Daily OTP limit reached. Please try again tomorrow." });
  }

  const otp = generateOTP();
  await storeOTP(cleanPhone, otp);
  await resetOTPAttempts(cleanPhone);
  await setOTPCooldown(cleanPhone);

  try {
    const templateName = process.env.WHATSAPP_OTP_TEMPLATE || "otp_code";
    const to = `91${cleanPhone}`;
    console.log("[AUTH] Sending OTP:", { to, templateName, otp });
    const result = await sendTemplate(to, templateName, "en", [
      { type: "body", parameters: [{ type: "text", text: otp }] },
      {
        type: "button",
        sub_type: "url",
        index: 0,
        parameters: [{ type: "text", text: otp }],
      },
    ]);
    console.log("[AUTH] OTP sent successfully:", result);
  } catch (err) {
    console.error("[AUTH] WhatsApp send failed:", err.message);
    return res.status(500).json({ error: "Failed to send OTP" });
  }

  return res
    .status(200)
    .json({ success: true, message: "OTP sent via WhatsApp" });
}

async function handleVerifyOTP(req, res) {
  const { phone, otp } = req.body || {};
  const cleanPhone = phone?.replace(/\D/g, "");

  if (!cleanPhone || !/^[0-9]{10}$/.test(cleanPhone)) {
    return res.status(400).json({ error: "Invalid phone number" });
  }
  if (!otp || !/^[0-9]{6}$/.test(otp)) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  // Attempt lockout: every verify attempt increments a counter; once past
  // OTP_MAX_ATTEMPTS the OTP is invalidated and further attempts are refused.
  const attempt = await incrOTPAttempts(cleanPhone);
  if (attempt > OTP_MAX_ATTEMPTS) {
    await deleteOTP(cleanPhone);
    res.setHeader("Retry-After", String(OTP_TTL_SECONDS));
    return res
      .status(429)
      .json({ error: "Too many attempts. Request a new OTP." });
  }

  const stored = await getOTP(cleanPhone);
  if (!stored || !safeEqualStrings(stored.otp, otp)) {
    if (attempt >= OTP_MAX_ATTEMPTS) await deleteOTP(cleanPhone);
    return res.status(401).json({ error: "Invalid or expired OTP" });
  }

  await deleteOTP(cleanPhone);
  await resetOTPAttempts(cleanPhone);

  const token = createSessionToken();
  // Store the same international format (91XXXXXXXXXX) used everywhere else
  // so dashboard lookups also find subscriptions created via WhatsApp.
  await storeSession(token, `91${cleanPhone}`);

  setSessionCookie(res, token);
  return res.status(200).json({ success: true, token });
}

async function handleLogout(req, res) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  if (match) {
    await deleteSession(match[1]);
  }
  res.setHeader(
    "Set-Cookie",
    "session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
  );
  return res.status(200).json({ success: true });
}

async function handleMe(req, res) {
  const session = await readSession(req);
  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const phone = session.phone;

  // Sliding session, throttled and off the critical path. Previously this
  // awaited an EXPIRE before any data was fetched, so every /me cost two
  // serial Redis round trips. Now it only fires once per interval, and when
  // it does fire it runs concurrently with the Supabase queries rather than
  // ahead of them.
  const isStale =
    Date.now() - (session.createdAt || 0) >= SESSION_REFRESH_INTERVAL_MS;
  const refresh = isStale ? refreshSession(session.token, phone) : null;

  // One customer lookup, shared: the addresses branch waits on the very same
  // in-flight promise and reuses its id, so it costs no extra latency and
  // one fewer round trip than letting it fetch the customer again.
  const customerPromise = getCustomerByPhone(phone);
  const [customer, subscriptions, upcomingMeals, addresses] = await Promise.all(
    [
      customerPromise,
      getActiveSubscriptions(phone),
      getUpcomingMeals(phone),
      customerPromise.then((c) => getCustomerAddresses(phone, c?.id)),
    ],
  );

  if (refresh) {
    await refresh;
    setSessionCookie(res, session.token);
  }

  return res.status(200).json({
    phone,
    name: customer?.name,
    email: customer?.email,
    addresses,
    subscriptions,
    upcomingMeals,
  });
}

/**
 * Read the session record from the request cookie: { token, phone, createdAt }
 * or null. handleMe needs createdAt to decide whether the sliding TTL is due;
 * the other handlers only want the phone, via sessionPhone below.
 */
async function readSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const token = match[1];
  const session = await getSession(token);
  if (!session) return null;
  return { token, ...session };
}

/** Resolve the authenticated phone from the session cookie, or 401. */
async function sessionPhone(req, res) {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: "Session expired or invalid" });
    return null;
  }
  return session.phone;
}

async function getCustomerIdByPhone(phone) {
  const customer = await getCustomerByPhone(phone);
  return customer?.id || null;
}

/**
 * @param knownCustomerId pass the customer id when the caller already has
 *   it, to avoid re-querying the same customer row.
 */
async function getCustomerAddresses(phone, knownCustomerId) {
  const customerId = knownCustomerId || (await getCustomerIdByPhone(phone));
  if (!customerId) return [];
  const { data } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return data || [];
}

async function handleUpdateProfile(req, res) {
  const phone = await sessionPhone(req, res);
  if (!phone) return;

  const { name, email } = req.body || {};
  const updates = {};
  if (name !== undefined) updates.name = String(name).slice(0, 200);
  if (email !== undefined) updates.email = String(email).slice(0, 300);
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .upsert({ phone, ...updates }, { onConflict: "phone" })
    .select("id, name, email")
    .single();

  if (error) {
    console.error("[AUTH] Profile update failed:", JSON.stringify(error));
    return res.status(500).json({ error: "Failed to update profile" });
  }

  return res.status(200).json({
    success: true,
    name: customer.name,
    email: customer.email,
    addresses: await getCustomerAddresses(phone),
  });
}

function normalizeAddressLocation(location) {
  if (!location) return null;
  if (typeof location === "string") return { areaName: location };
  return location;
}

async function handleAddAddress(req, res) {
  const phone = await sessionPhone(req, res);
  if (!phone) return;

  const { label, address, location } = req.body || {};
  if (!address || !String(address).trim()) {
    return res.status(400).json({ error: "Address is required" });
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert({ phone }, { onConflict: "phone" })
    .select("id")
    .single();

  if (customerError || !customer) {
    console.error(
      "[AUTH] Address add — customer upsert failed:",
      JSON.stringify(customerError),
    );
    return res.status(500).json({ error: "Failed to save address" });
  }

  const { data: addressRow, error } = await supabase
    .from("customer_addresses")
    .insert({
      customer_id: customer.id,
      label: String(label || "Home").slice(0, 100),
      address: String(address).trim(),
      location: normalizeAddressLocation(location),
      is_default: false,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[AUTH] Address add failed:", JSON.stringify(error));
    return res.status(500).json({ error: "Failed to save address" });
  }

  // First saved address becomes the default.
  const { count } = await supabase
    .from("customer_addresses")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customer.id);
  if (count === 1) {
    await setDefaultAddress(customer.id, addressRow.id);
  }

  return res.status(200).json({
    success: true,
    addresses: await getCustomerAddresses(phone),
  });
}

async function handleUpdateAddress(req, res, path) {
  const phone = await sessionPhone(req, res);
  if (!phone) return;

  const addressId = path.split("/").pop();
  const customerId = await getCustomerIdByPhone(phone);
  if (!customerId) {
    return res.status(404).json({ error: "Address not found" });
  }

  const { label, address, location, is_default } = req.body || {};
  const updates = {};
  if (label !== undefined) updates.label = String(label).slice(0, 100);
  if (address !== undefined) {
    updates.address = String(address).trim();
    updates.updated_at = new Date().toISOString();
  }
  if (location !== undefined) {
    updates.location = normalizeAddressLocation(location);
  }

  const { error } = await supabase
    .from("customer_addresses")
    .update(updates)
    .eq("id", addressId)
    .eq("customer_id", customerId);

  if (error) {
    console.error("[AUTH] Address update failed:", JSON.stringify(error));
    return res.status(500).json({ error: "Failed to update address" });
  }

  if (is_default) {
    await setDefaultAddress(customerId, addressId);
  }

  return res.status(200).json({
    success: true,
    addresses: await getCustomerAddresses(phone),
  });
}

async function handleDeleteAddress(req, res, path) {
  const phone = await sessionPhone(req, res);
  if (!phone) return;

  const addressId = path.split("/").pop();
  const customerId = await getCustomerIdByPhone(phone);
  if (!customerId) {
    return res.status(404).json({ error: "Address not found" });
  }

  const { error } = await supabase
    .from("customer_addresses")
    .delete()
    .eq("id", addressId)
    .eq("customer_id", customerId);

  if (error) {
    console.error("[AUTH] Address delete failed:", JSON.stringify(error));
    return res.status(500).json({ error: "Failed to delete address" });
  }

  return res.status(200).json({
    success: true,
    addresses: await getCustomerAddresses(phone),
  });
}

async function setDefaultAddress(customerId, addressId) {
  // Clear any existing default first, then set the new one.
  await supabase
    .from("customer_addresses")
    .update({ is_default: false })
    .eq("customer_id", customerId)
    .neq("id", addressId);
  await supabase
    .from("customer_addresses")
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq("id", addressId)
    .eq("customer_id", customerId);
}
