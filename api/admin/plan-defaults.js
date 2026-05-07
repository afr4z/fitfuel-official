import { createClient } from "@supabase/supabase-js";
import { isPastIST, tomorrowDateStrIST } from "../../lib/cronUtils.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function unauthorized(res) {
  return res.status(401).json({ error: "Unauthorized" });
}

const SLOTS = ["breakfast", "lunch", "dinner"];
const DAYS = [1, 2, 3, 4, 5, 6];
const DAY_LABELS = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };

export default async function handler(req, res) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${adminSecret}`) return unauthorized(res);
  }

  if (req.method === "GET") {
    const tomorrow = tomorrowDateStrIST();
    const isLocked = isPastIST(19, 45);

    const [plansRes, dishesRes, weeklyRes, nextDayRes] = await Promise.all([
      supabase.from("meal_plans").select("id, name, tag, emoji").eq("is_active", true).order("name"),
      supabase.from("dishes").select("id, meal_plan_id, name, is_veg, price").eq("is_available", true).order("name"),
      supabase.from("weekly_meal_schedule").select("plan_id, day_of_week, slot, dish_id"),
      supabase.from("next_day_meals").select("plan_id, date, slot, dish_id").eq("date", tomorrow),
    ]);

    if (plansRes.error) return res.status(500).json({ error: plansRes.error.message });
    if (dishesRes.error) return res.status(500).json({ error: dishesRes.error.message });
    if (weeklyRes.error) return res.status(500).json({ error: weeklyRes.error.message });
    if (nextDayRes.error) return res.status(500).json({ error: nextDayRes.error.message });

    const weeklyIndex = {};
    for (const w of weeklyRes.data) {
      weeklyIndex[`${w.plan_id}:${w.day_of_week}:${w.slot}`] = w.dish_id;
    }

    const nextDayIndex = {};
    for (const n of nextDayRes.data) {
      nextDayIndex[`${n.plan_id}:${n.slot}`] = n.dish_id;
    }

    const plans = plansRes.data.map((p) => ({
      id: p.id,
      name: `${p.emoji || "🥗"} ${p.name}`,
      tag: p.tag,
      dishes: dishesRes.data
        .filter((d) => d.meal_plan_id === p.id)
        .map((d) => ({ id: d.id, name: d.name, is_veg: d.is_veg, price: d.price })),
      week: Object.fromEntries(
        DAYS.map((dow) => [
          dow,
          Object.fromEntries(
            SLOTS.map((slot) => [slot, weeklyIndex[`${p.id}:${dow}:${slot}`] || null]),
          ),
        ]),
      ),
      nextDay: Object.fromEntries(
        SLOTS.map((slot) => [slot, nextDayIndex[`${p.id}:${slot}`] || null]),
      ),
    }));

    return res.status(200).json({
      plans,
      dayLabels: DAY_LABELS,
      slots: SLOTS,
      tomorrow,
      locked: isLocked,
    });
  }

  if (req.method === "POST") {
    const { type, plan_id, day_of_week, slot, dish_id, date } = req.body ?? {};

    if (!plan_id || !slot || !type) {
      return res.status(400).json({ error: "type, plan_id, and slot are required" });
    }

    if (!SLOTS.includes(slot)) {
      return res.status(400).json({ error: "Invalid slot" });
    }

    if (type === "weekly") {
      if (![1, 2, 3, 4, 5, 6].includes(day_of_week)) {
        return res.status(400).json({ error: "Invalid day_of_week for weekly schedule" });
      }

      if (dish_id) {
        const { error: upsertErr } = await supabase
          .from("weekly_meal_schedule")
          .upsert(
            { plan_id, day_of_week, slot, dish_id },
            { onConflict: "plan_id,day_of_week,slot" },
          );

        if (upsertErr) {
          console.error("[ADMIN] Weekly upsert failed:", upsertErr.message);
          return res.status(500).json({ error: "Failed to save" });
        }
      } else {
        return res.status(400).json({ error: "dish_id is required for weekly schedule" });
      }

      return res.status(200).json({ ok: true, type: "weekly" });
    }

    if (type === "nextday") {
      if (isPastIST(19, 45)) {
        return res.status(403).json({ error: "Tomorrow's menu is locked after 7:45pm IST" });
      }

      const targetDate = date || tomorrowDateStrIST();

      if (dish_id) {
        const { error: upsertErr } = await supabase
          .from("next_day_meals")
          .upsert(
            { plan_id, date: targetDate, slot, dish_id },
            { onConflict: "plan_id,date,slot" },
          );

        if (upsertErr) {
          console.error("[ADMIN] Nextday upsert failed:", upsertErr.message);
          return res.status(500).json({ error: "Failed to save" });
        }
      } else {
        const { error: deleteErr } = await supabase
          .from("next_day_meals")
          .delete()
          .eq("plan_id", plan_id)
          .eq("date", targetDate)
          .eq("slot", slot);

        if (deleteErr) {
          console.error("[ADMIN] Nextday delete failed:", deleteErr.message);
          return res.status(500).json({ error: "Failed to clear" });
        }
      }

      return res.status(200).json({ ok: true, type: "nextday" });
    }

    return res.status(400).json({ error: 'Invalid type — must be "weekly" or "nextday"' });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
