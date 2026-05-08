import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PETPOOJA_PROXY_URL = process.env.PETPOOJA_PROXY_URL;
const PETPOOJA_SAVE_ORDER_URL = PETPOOJA_PROXY_URL
  ? `${PETPOOJA_PROXY_URL}/save-order`
  : "https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1/save_order";

export async function getMenuItems(limit = 10) {
  const { data, error } = await supabase
    .from("dishes")
    .select("id, name, is_veg, price")
    .eq("is_available", true)
    .limit(limit);

  if (error) {
    console.error("[DB] Failed to fetch dishes:", error.message);
    return [];
  }

  console.log(`[PETPOOJA] getMenuItems: fetched ${data?.length ?? 0} dishes (limit=${limit})`);
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
    app_key: process.env.PETPOOJA_APP_KEY,
    app_secret: process.env.PETPOOJA_APP_SECRET,
    access_token: process.env.PETPOOJA_ACCESS_TOKEN,
    restID: process.env.PETPOOJA_RESTAURANT_ID,
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
