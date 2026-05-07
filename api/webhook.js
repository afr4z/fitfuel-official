console.log("[BOOT] webhook function starting");
import { markAsRead } from "../lib/whatsapp.js";
import { handleIncoming } from "../bot/handler.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "fitfuel-secret";

function extractMessage(body) {
  try {
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages?.length) return null;
    const msg = value.messages[0];
    if (msg?.origin?.type === "business") return null;
    return { from: msg.from, message: msg };
  } catch {
    return null;
  }
}

function mapAttribute(itemAttrId) {
  if (itemAttrId === "1") return true;
  if (itemAttrId === "2") return false;
  return true;
}

async function syncPetpoojaMenu(petpoojaData) {
  const { data: plans } = await supabase
    .from("meal_plans")
    .select("id, name, tag")
    .eq("is_active", true);
  if (!plans?.length) return { upserted: 0, disabled: 0 };

  const { data: existing } = await supabase
    .from("dishes")
    .select("id, name, is_veg, price, is_available, meal_plan_id");

  const existingByName = {};
  for (const d of existing || []) {
    existingByName[`${d.name}|${d.meal_plan_id}`] = d;
  }

  const itemCategoryMap = {};
  for (const cat of petpoojaData.categories || []) {
    itemCategoryMap[cat.categoryid] = cat.categoryname;
  }

  const toUpsert = [];
  const petpoojaKeys = new Set();

  for (const item of petpoojaData.items || []) {
    const name = item.itemname?.trim();
    if (!name) continue;
    const isActive = item.active === "1";
    const price = parseFloat(item.price) || 0;
    const isVeg = mapAttribute(item.item_attributeid);
    const category = itemCategoryMap[item.item_categoryid] || "Uncategorized";

    for (const plan of plans) {
      const key = `${name}|${plan.id}`;
      petpoojaKeys.add(key);
      const existingRow = existingByName[key];
      toUpsert.push({
        id: existingRow?.id || undefined,
        meal_plan_id: plan.id,
        name,
        description: category,
        is_veg: isVeg,
        price,
        is_available: isActive,
      });
    }
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("dishes")
      .upsert(toUpsert.slice(i, i + BATCH_SIZE), { onConflict: "id" });
    if (error) throw error;
  }

  const toDisable = (existing || []).filter(
    (d) => d.is_available && !petpoojaKeys.has(`${d.name}|${d.meal_plan_id}`),
  );
  if (toDisable.length) {
    await supabase
      .from("dishes")
      .update({ is_available: false })
      .in("id", toDisable.map((d) => d.id));
  }

  return { upserted: toUpsert.length, disabled: toDisable.length };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const {
      "hub.mode": mode,
      "hub.verify_token": token,
      "hub.challenge": challenge,
    } = req.query;
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: "Verification failed" });
  }

  if (req.method === "POST") {
    // Route: Petpooja menu sync from proxy
    if (req.headers["x-purpose"] === "petproxy") {
      const auth = req.headers["authorization"] ?? "";
      if (auth !== `Bearer ${INTERNAL_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      try {
        const result = await syncPetpoojaMenu(req.body);
        console.log("[PETPROXY] Sync result:", result);
        return res.status(200).json({ success: "1", ...result });
      } catch (err) {
        console.error("[PETPROXY] Sync error:", err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    // Route: WhatsApp messages
    const extracted = extractMessage(req.body);
    if (extracted) {
      const { from, message } = extracted;
      try {
        await handleIncoming(from, message);
      } catch (e) {
        console.error("[BOT] Error:", e.message, e.stack);
      }
    }

    return res.status(200).json({ status: "ok" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
