import { createClient } from "@supabase/supabase-js";
import { sendText } from "../../lib/whatsapp.js";
import { addDeliveryDays, countRemainingDeliveryDays } from "../../lib/deliveryDays.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * GET  /api/admin/kitchen-closed — returns a list of upcoming kitchen-closed days.
 * POST /api/admin/kitchen-closed — marks a date as kitchen-closed.
 *
 * Protected by ADMIN_SECRET (same shared secret used by the admin panel).
 *
 * POST body (JSON):
 *   { date: "YYYY-MM-DD", reason?: string }
 */
export default async function handler(req, res) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const authHeader = req.headers["authorization"] ?? "";
    if (authHeader !== `Bearer ${adminSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (req.method === "GET") {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("kitchen_closed_days")
      .select("date, reason")
      .gte("date", today)
      .order("date");

    if (error) {
      console.error("[KITCHEN-CLOSED] GET error:", error);
      return res.status(500).json({ error: "Failed to fetch closed days" });
    }

    return res.status(200).json({ closedDays: data ?? [] });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { date, reason } = req.body ?? {};

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ error: "Missing or invalid date (expected YYYY-MM-DD)" });
  }

  // Insert kitchen-closed record
  const { error: insertError } = await supabase
    .from("kitchen_closed_days")
    .insert({ date, reason: reason ?? null });

  if (insertError) {
    if (insertError.code === "23505") {
      return res
        .status(409)
        .json({ error: "Kitchen already marked as closed on that date" });
    }
    console.error("[KITCHEN-CLOSED] Insert error:", insertError);
    return res.status(500).json({ error: "Failed to mark kitchen as closed" });
  }

  // Fetch all active subscriptions whose end_date is on or after the closed date
  const { data: activeSubs, error: fetchError } = await supabase
    .from("meal_plan_subscriptions")
    .select("id, phone, end_date, start_date")
    .eq("status", "active")
    .gte("end_date", date);

  if (fetchError) {
    console.error("[KITCHEN-CLOSED] Fetch subscriptions error:", fetchError);
    return res
      .status(500)
      .json({ error: "Failed to fetch active subscriptions" });
  }

  const subs = activeSubs ?? [];

  // Extend each subscription's end_date by 1 calendar day and notify the customer
  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      // Extend by 1 delivery day (skips Sundays) so the new end_date
      // is always a valid delivery day
      const newEndStr = addDeliveryDays(sub.end_date, 1);

      const { error: updateError } = await supabase
        .from("meal_plan_subscriptions")
        .update({ end_date: newEndStr })
        .eq("id", sub.id);

      if (updateError) {
        console.error(
          `[KITCHEN-CLOSED] Failed to extend sub ${sub.id}:`,
          updateError,
        );
        return;
      }

      const remaining = await countRemainingDeliveryDays(sub.start_date, newEndStr);
      const reasonLine = reason ? `\nReason: _${reason}_\n` : "\n";

      await sendText(
        sub.phone,
        `🔒 *Kitchen Closed — ${date}*\n` +
          reasonLine +
          `\nWe're sorry, our kitchen won't be operating on ${date}. No meals will be delivered that day.\n\n` +
          `✅ Your plan has been extended by 1 day to make up for it.\n` +
          `📅 You now have *${remaining} delivery day(s)* remaining.\n\n` +
          `We'll be back the next working day! 🙏`,
      );
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.error(`[KITCHEN-CLOSED] ${failed.length} notifications failed`);
  }

  return res.status(200).json({
    date,
    extended: subs.length,
    failed: failed.length,
  });
}
