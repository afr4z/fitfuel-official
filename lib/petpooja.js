import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PETPOOJA_PROXY_URL = process.env.PETPOOJA_PROXY_URL;
const PETPOOJA_SAVE_ORDER_URL = PETPOOJA_PROXY_URL
  ? `${PETPOOJA_PROXY_URL}/save-order`
  : process.env.PETPOOJA_SAVE_ORDER_URL || "https://pponlineordercb.petpooja.com/save_order";
const PETPOOJA_RIDER_STATUS_UPDATE_URL =
  process.env.PETPOOJA_RIDER_STATUS_UPDATE_URL ||
  (PETPOOJA_PROXY_URL
    ? `${PETPOOJA_PROXY_URL}/rider-status-update`
    : "https://pponlineordercb.petpooja.com/rider_status_update");
const PETPOOJA_UPDATE_ORDER_STATUS_URL =
  process.env.PETPOOJA_UPDATE_ORDER_STATUS_URL ||
  (PETPOOJA_PROXY_URL
    ? `${PETPOOJA_PROXY_URL}/update-order-status`
    : "https://pponlineordercb.petpooja.com/update_order_status");

const DEFAULT_PETPOOJA_APP_KEY = "***REMOVED***";
const DEFAULT_PETPOOJA_APP_SECRET = "***REMOVED***";
const DEFAULT_PETPOOJA_ACCESS_TOKEN = "***REMOVED***";
const DEFAULT_PETPOOJA_RESTAURANT_ID = "piewf0rzhj";
const DEFAULT_PETPOOJA_CLIENT_ID = "425714";


export async function getMenuItems({ limit = 10, mealPlanId, slot } = {}) {
  let query = supabase
    .from("dishes")
    .select("id, name, is_veg, price")
    .eq("is_available", true);

  if (mealPlanId) {
    query = query.eq("meal_plan_id", mealPlanId);
  }

  if (slot) {
    query = query.eq("slot", slot);
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("[DB] Failed to fetch dishes:", error.message);
    return [];
  }

  console.log(`[PETPOOJA] getMenuItems: fetched ${data?.length ?? 0} dishes (limit=${limit}, mealPlanId=${mealPlanId})`);
  return data.map((d) => ({
    itemid: d.id,
    itemname: d.name,
    item_type: d.is_veg ? "1" : "2",
    price: d.price.toString(),
  }));
}

export async function getCategories() {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, name, tag")
    .eq("is_active", true);

  if (error) {
    console.error("[DB] Failed to fetch meal plans:", error.message);
    return [];
  }

  return data.map((p) => ({
    categoryid: p.id,
    categoryname: p.name,
    tag: p.tag,
  }));
}

export async function placeOrder({
  orderId,
  customerName,
  customerPhone,
  deliveryAddress,
  deliveryDate,
  deliveryTime,
  orderType = "H",
  total,
  paymentType = "ONLINE",
  items,
  callbackUrl = "",
  instructions = "",
}) {
  const payload = {
    app_key: process.env.PETPOOJA_APP_KEY || DEFAULT_PETPOOJA_APP_KEY,
    app_secret: process.env.PETPOOJA_APP_SECRET || DEFAULT_PETPOOJA_APP_SECRET,
    access_token: process.env.PETPOOJA_ACCESS_TOKEN || DEFAULT_PETPOOJA_ACCESS_TOKEN,
    restID: process.env.PETPOOJA_RESTAURANT_ID || DEFAULT_PETPOOJA_RESTAURANT_ID,
    customer: {
      name: customerName,
      phone: customerPhone,
      address: deliveryAddress,
    },
    order: {
      orderID: orderId,
      preorder_date: deliveryDate,
      preorder_time: deliveryTime,
      advanced_order: "Y",
      order_type: orderType,
      total: total.toFixed(2),
      payment_type: paymentType,
      callback_url: callbackUrl,
      description: instructions,
      dc_tax_percentage: "5",
      pc_tax_percentage: "5",
      created_on: new Date().toISOString().replace("T", " ").slice(0, 19),
    },
    order_items: items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price.toFixed(2),
      final_price: item.price.toFixed(2),
      quantity: item.quantity.toString(),
      tax_inclusive: true,
      gst_liability: "restaurant",
    })),
  };

  const headers = { "Content-Type": "application/json" };
  if (PETPOOJA_PROXY_URL) {
    headers["Authorization"] = `Bearer ${process.env.INTERNAL_SECRET || "fitfuel-secret"}`;
  }

  const res = await fetch(PETPOOJA_SAVE_ORDER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Petpooja Save Order API error (${res.status}): ${err}`);
  }

  return res.json();
}

export async function updateRiderStatus({
  orderId,
  restID = process.env.PETPOOJA_RESTAURANT_ID || DEFAULT_PETPOOJA_RESTAURANT_ID,
  rider_name,
  rider_phone,
  status,
  ...rest
} = {}) {
  const payload = {
    app_key: process.env.PETPOOJA_APP_KEY || DEFAULT_PETPOOJA_APP_KEY,
    app_secret: process.env.PETPOOJA_APP_SECRET || DEFAULT_PETPOOJA_APP_SECRET,
    access_token: process.env.PETPOOJA_ACCESS_TOKEN || DEFAULT_PETPOOJA_ACCESS_TOKEN,
    restID,
    orderID: orderId,
    ...rest,
  };

  if (rider_name) payload.rider_name = rider_name;
  if (rider_phone) payload.rider_phone = rider_phone;
  if (status) payload.status = status;

  const headers = { "Content-Type": "application/json" };
  if (PETPOOJA_PROXY_URL) {
    headers["Authorization"] = `Bearer ${process.env.INTERNAL_SECRET || "fitfuel-secret"}`;
  }

  const res = await fetch(PETPOOJA_RIDER_STATUS_UPDATE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Petpooja Rider Status Update API error (${res.status}): ${err}`);
  }

  return res.json();
}

export async function updateOrderStatus({
  orderId,
  restID = process.env.PETPOOJA_RESTAURANT_ID || DEFAULT_PETPOOJA_RESTAURANT_ID,
  status,
  cancel_reason = "",
  ...rest
} = {}) {
  const payload = {
    app_key: process.env.PETPOOJA_APP_KEY || DEFAULT_PETPOOJA_APP_KEY,
    app_secret: process.env.PETPOOJA_APP_SECRET || DEFAULT_PETPOOJA_APP_SECRET,
    access_token: process.env.PETPOOJA_ACCESS_TOKEN || DEFAULT_PETPOOJA_ACCESS_TOKEN,
    restID,
    orderID: orderId,
    status,
    cancel_reason,
    ...rest,
  };

  const headers = { "Content-Type": "application/json" };
  if (PETPOOJA_PROXY_URL) {
    headers["Authorization"] = `Bearer ${process.env.INTERNAL_SECRET || "fitfuel-secret"}`;
  }

  const res = await fetch(PETPOOJA_UPDATE_ORDER_STATUS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Petpooja Update Order Status API error (${res.status}): ${err}`);
  }

  return res.json();
}
