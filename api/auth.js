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
  return getMagicToken(token);
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
    .select("id, name, email, address, location")
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

  await deleteMagicToken(magic.otp ? `magic:${magic.otp}` : ""); // cleanup
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
  return res
    .status(200)
    .json({
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
  await storeSession(token, cleanPhone);

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
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const session = await getSession(match[1]);
  if (!session) {
    return res.status(401).json({ error: "Session expired" });
  }

  const phone = session.phone;
  const [customer, subscriptions, upcomingMeals] = await Promise.all([
    getCustomerByPhone(phone),
    getActiveSubscriptions(phone),
    getUpcomingMeals(phone),
  ]);

  return res.status(200).json({
    phone,
    name: customer?.name,
    email: customer?.email,
    address: customer?.address,
    location: customer?.location,
    subscriptions,
    upcomingMeals,
  });
}
