import { createClient } from "@supabase/supabase-js";
import { sendText, sendTemplate } from "../lib/whatsapp.js";
import { sendNotification } from "../lib/sendNotification.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const OTP_TTL_SECONDS = 300;
const SESSION_TTL_DAYS = 30;

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
  return `${Date.now()}_${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

async function storeSession(token, phone) {
  const key = `session:${token}`;
  const data = JSON.stringify({ phone, createdAt: Date.now() });
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    },
    body: data,
  });
  await fetch(
    `${process.env.UPSTASH_REDIS_REST_URL}/expire/${key}/${SESSION_TTL_DAYS * 86400}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      },
    },
  );
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

  res.setHeader(
    "Set-Cookie",
    `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_DAYS * 86400}`,
  );
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

  res.setHeader(
    "Set-Cookie",
    `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_DAYS * 86400}`,
  );
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

  const otp = generateOTP();
  await storeOTP(cleanPhone, otp);

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

  const stored = await getOTP(cleanPhone);
  if (!stored || stored.otp !== otp) {
    return res.status(401).json({ error: "Invalid or expired OTP" });
  }

  await deleteOTP(cleanPhone);

  const token = createSessionToken();
  // Store the same international format (91XXXXXXXXXX) used everywhere else
  // so dashboard lookups also find subscriptions created via WhatsApp.
  await storeSession(token, `91${cleanPhone}`);

  res.setHeader(
    "Set-Cookie",
    `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_DAYS * 86400}`,
  );
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
  const phone = await sessionPhone(req, res);
  if (!phone) return;

  const [customer, subscriptions, upcomingMeals, addresses] = await Promise.all(
    [
      getCustomerByPhone(phone),
      getActiveSubscriptions(phone),
      getUpcomingMeals(phone),
      getCustomerAddresses(phone),
    ],
  );

  return res.status(200).json({
    phone,
    name: customer?.name,
    email: customer?.email,
    addresses,
    subscriptions,
    upcomingMeals,
  });
}

/** Resolve the authenticated phone from the session cookie, or 401. */
async function sessionPhone(req, res) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }

  const session = await getSession(match[1]);
  if (!session) {
    res.status(401).json({ error: "Session expired" });
    return null;
  }

  return session.phone;
}

async function getCustomerIdByPhone(phone) {
  const customer = await getCustomerByPhone(phone);
  return customer?.id || null;
}

async function getCustomerAddresses(phone) {
  const customerId = await getCustomerIdByPhone(phone);
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
