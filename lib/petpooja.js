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
  const createdOn = new Date().toISOString().replace("T", " ").slice(0, 19);
  const orderItems = items.map((item) => ({
    id: item.id,
    name: item.name,
    price: Number(item.price).toFixed(2),
    final_price: Number(item.price).toFixed(2),
    quantity: item.quantity.toString(),
    tax_inclusive: true,
    gst_liability: "restaurant",
    item_tax: [],
    item_discount: "0",
    variation_name: "",
    variation_id: "",
    AddonItem: { details: [] },
  }));

  const payload = {
    app_key: process.env.PETPOOJA_APP_KEY || DEFAULT_PETPOOJA_APP_KEY,
    app_secret: process.env.PETPOOJA_APP_SECRET || DEFAULT_PETPOOJA_APP_SECRET,
    access_token: process.env.PETPOOJA_ACCESS_TOKEN || DEFAULT_PETPOOJA_ACCESS_TOKEN,
    device_type: "Web",
    orderinfo: {
      OrderInfo: {
        Restaurant: {
          details: {
            restID: process.env.PETPOOJA_RESTAURANT_ID || DEFAULT_PETPOOJA_RESTAURANT_ID,
            res_name: "FitFuel Nutrition",
            address: deliveryAddress,
            contact_information: customerPhone,
          },
        },
        Customer: {
          details: {
            name: customerName,
            phone: customerPhone,
            address: deliveryAddress,
            email: "",
            latitude: "",
            longitude: "",
          },
        },
        Order: {
          details: {
            orderID: orderId,
            preorder_date: deliveryDate,
            preorder_time: deliveryTime,
            service_charge: "0",
            sc_tax_amount: "0",
            delivery_charges: "0",
            dc_tax_percentage: "0",
            dc_tax_amount: "0",
            packing_charges: "0",
            pc_tax_amount: "0",
            pc_tax_percentage: "0",
            order_type: orderType,
            payment_type: paymentType,
            discount_type: "F",
            discount_total: "0",
            tax_total: "0",
            total: total.toFixed(2),
            advanced_order: "Y",
            callback_url: callbackUrl,
            created_on: createdOn,
          },
        },
        OrderItem: { details: orderItems },
        Tax: { details: [] },
      },
    },
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
