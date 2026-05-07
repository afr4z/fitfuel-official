import { createClient } from "@supabase/supabase-js";
import {
  tomorrowDateStrIST,
  checkSkipped,
  autoFillNextDay,
  commitOrders,
} from "../../lib/cronUtils.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const deliveryDate = tomorrowDateStrIST();

    const skipped = await checkSkipped(deliveryDate);
    if (skipped) {
      console.log(`[COMMIT] Skipping — ${skipped} on ${deliveryDate}`);
      return res.status(200).json({ skipped, delivery_date: deliveryDate });
    }

    console.log(`[COMMIT] Auto-filling next_day_meals for ${deliveryDate}`);
    const fillResult = await autoFillNextDay(deliveryDate);

    console.log(`[COMMIT] Committing orders for ${deliveryDate}`);
    const commitResult = await commitOrders(deliveryDate);

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    const { error: expireError } = await supabase
      .from("meal_plan_subscriptions")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("end_date", dateStr);

    if (expireError) {
      console.error("[COMMIT] Failed to mark expired subscriptions:", expireError);
    }

    return res.status(200).json({
      delivery_date: deliveryDate,
      auto_filled: fillResult.filled ?? 0,
      orders_created: commitResult.created ?? 0,
    });
  } catch (err) {
    console.error("[CRON/commit-meals]", err);
    return res.status(500).json({ error: err.message });
  }
}
