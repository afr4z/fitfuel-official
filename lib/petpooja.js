const BASE_URL =
  process.env.PETPOOJA_API_URL || "https://api.petpooja.com";

async function fetchMenu() {
  const res = await fetch(`${BASE_URL}/api/v2/restlogin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_key: process.env.PETPOOJA_APP_KEY,
      app_secret: process.env.PETPOOJA_APP_SECRET,
      access_token: process.env.PETPOOJA_ACCESS_TOKEN,
      restaurantid: process.env.PETPOOJA_RESTAURANT_ID,
    }),
  });

  if (!res.ok) {
    throw new Error(`PetPooja API error: ${res.status}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(`PetPooja error: ${data.message}`);
  }
  return data;
}

/**
 * Returns up to `limit` menu items from PetPooja.
 * Each item has at minimum: { itemid, itemname, item_type, price }
 *   item_type "1" = Veg, "2" = Non-Veg
 */
export async function getMenuItems(limit = 10) {
  const { items } = await fetchMenu();
  if (!items) return [];
  return items.slice(0, limit);
}

/**
 * Returns all PetPooja menu categories.
 * Each entry has at minimum: { categoryid, categoryname }
 */
export async function getCategories() {
  const { categories } = await fetchMenu();
  return categories || [];
}
