import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Clients ───────────────────────────────────────────────────────────────

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const VERCEL_URL = Deno.env.get("VERCEL_URL")!; // e.g. https://fitfuel.vercel.app
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

// ─── Vercel Notify Helper ─────────────────────────────────────────────────

async function notifyViaVercel(
  to: string,
  body: string,
  buttons?: { id: string; title: string }[],
) {
  const res = await fetch(`${VERCEL_URL}/api/notify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, body, buttons }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[NOTIFY] Failed for ${to}:`, err);
    throw new Error(`Vercel notify failed for ${to}: ${res.status}`);
  }
}

// ─── Slot Config ───────────────────────────────────────────────────────────

const SLOT_LABELS: Record<string, string> = {
  breakfast: "🌅 Breakfast",
  lunch: "☀️ Lunch",
  dinner: "🌙 Dinner",
};

const SLOT_CUTOFF_MINUTES: Record<string, number> = {
  breakfast: 30,
  lunch: 60,
  dinner: 60,
};

// ─── Main ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const { slot } = (await req.json()) as {
      slot: "breakfast" | "lunch" | "dinner";
    };

    if (!slot || !["breakfast", "lunch", "dinner"].includes(slot)) {
      return new Response(JSON.stringify({ error: "Invalid slot" }), {
        status: 400,
      });
    }

    const today = new Date().toISOString().split("T")[0];
    console.log(`[CRON] Processing slot=${slot} date=${today}`);

    // 1. Fetch all active subscription slots that include this slot
    const { data: slots, error } = await supabase
      .from("subscription_slots")
      .select(
        `
        *,
        meal_plan_subscriptions!inner (
          id,
          phone,
          status,
          end_date,
          plan_type
        )
      `,
      )
      .eq("slot", slot)
      .eq("meal_plan_subscriptions.status", "active")
      .gte("meal_plan_subscriptions.end_date", today);

    if (error) {
      console.error("[CRON] DB fetch error:", error);
      return new Response(JSON.stringify({ error }), { status: 500 });
    }

    const activeSlots = slots ?? [];
    console.log(`[CRON] Found ${activeSlots.length} active ${slot} subscribers`);

    // 2. Process each subscriber
    const results = await Promise.allSettled(
      activeSlots.map(async (slotRow: any) => {
        const sub = slotRow.meal_plan_subscriptions;
        const phone = sub.phone;

        // 2a. Check if order already exists for today (avoid duplicates on retry)
        const { data: existing } = await supabase
          .from("orders")
          .select("id")
          .eq("slot_id", slotRow.id)
          .eq("delivery_date", today)
          .single();

        if (existing) {
          console.log(
            `[CRON] Order already exists for ${phone} ${slot} ${today} — skipping`,
          );
          return;
        }

        // 2b. Create today's order with default meal
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            subscription_id: sub.id,
            slot_id: slotRow.id,
            phone,
            delivery_date: today,
            slot,
            delivery_time: slotRow.delivery_time,
            item_id: slotRow.default_item_id,
            item_name: slotRow.default_item_name,
            is_default: true,
            status: "pending",
            notified_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (orderError) {
          console.error(
            `[CRON] Failed to create order for ${phone}:`,
            orderError,
          );
          return;
        }

        // 2c. Check if plan expiring soon
        const daysLeft = Math.ceil(
          (new Date(sub.end_date).getTime() - new Date(today).getTime()) /
            (1000 * 60 * 60 * 24),
        );

        // 2d. Send WhatsApp notification via Vercel
        const slotLabel = SLOT_LABELS[slot];
        const cutoffMins = SLOT_CUTOFF_MINUTES[slot];
        const mealName = slotRow.default_item_name || "your default meal";

        await notifyViaVercel(
          phone,
          `${slotLabel} is coming up! 🍽️\n\n` +
            `*Today's meal:* ${mealName}\n` +
            `*Delivery at:* ${slotRow.delivery_time}\n\n` +
            `You have ${cutoffMins} mins to change your meal, or we'll deliver the default.` +
            (daysLeft <= 2
              ? `\n\n⚠️ Your plan expires in ${daysLeft} day(s)!`
              : ""),
          [
            { id: `CONFIRM_${order.id}`, title: "✅ Looks good" },
            { id: `CHANGE_${order.id}`, title: "🔄 Change meal" },
            { id: `SKIP_${order.id}`, title: "⏭️ Skip today" },
          ],
        );

        console.log(`[CRON] Notified ${phone} for ${slot}`);
      }),
    );

    // 3. Log any failures
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) {
      console.error(`[CRON] ${failed.length} notifications failed`);
    }

    // 4. Mark expired subscriptions
    await supabase
      .from("meal_plan_subscriptions")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("end_date", today);

    return new Response(
      JSON.stringify({
        slot,
        processed: activeSlots.length,
        failed: failed.length,
      }),
      { status: 200 },
    );
  } catch (err) {
    console.error("[CRON] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
    });
  }
});
