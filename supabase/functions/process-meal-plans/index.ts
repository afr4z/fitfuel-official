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

// mealsPerDay threshold required to be notified for each slot
const SLOT_MIN_MEALS: Record<string, number> = {
  breakfast: 1,
  lunch: 2,
  dinner: 3,
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

    // 1. Fetch active subscriptions that cover this meal slot.
    //    A subscription covers the slot when meals_per_day >= SLOT_MIN_MEALS[slot].
    //    Expiry is derived from created_at + days (days column holds subscription duration).
    const minMeals = SLOT_MIN_MEALS[slot];

    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select("id, phone, plan_title, meal_label, days, meals_per_day, created_at")
      .eq("status", "active")
      .gte("meals_per_day", minMeals);

    if (error) {
      console.error("[CRON] DB fetch error:", error);
      return new Response(JSON.stringify({ error }), { status: 500 });
    }

    const todayMs = new Date(today).getTime();

    // Filter out subscriptions whose calculated end_date has passed
    const active = (subscriptions ?? []).filter((sub: any) => {
      const startMs = new Date(sub.created_at).getTime();
      const endMs = startMs + sub.days * 24 * 60 * 60 * 1000;
      return endMs >= todayMs;
    });

    console.log(`[CRON] Found ${active.length} active ${slot} subscribers`);

    // 2. Send notifications via Vercel
    const results = await Promise.allSettled(
      active.map(async (sub: any) => {
        const phone = sub.phone;

        const startMs = new Date(sub.created_at).getTime();
        const endMs = startMs + sub.days * 24 * 60 * 60 * 1000;
        const daysLeft = Math.ceil((endMs - todayMs) / (1000 * 60 * 60 * 24));

        const slotLabel = SLOT_LABELS[slot];
        const cutoffMins = SLOT_CUTOFF_MINUTES[slot];

        const msgBody =
          `${slotLabel} is coming up! 🍽️\n\n` +
          `*Plan:* ${sub.plan_title}\n` +
          `*Meals:* ${sub.meal_label}\n\n` +
          `You have ${cutoffMins} mins to contact us if you need to make any changes.` +
          (daysLeft <= 2 ? `\n\n⚠️ Your plan expires in ${daysLeft} day(s)!` : "");

        await notifyViaVercel(phone, msgBody);

        console.log(`[CRON] Notified ${phone} for ${slot}`);
      }),
    );

    // 3. Log failures
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) {
      console.error(`[CRON] ${failed.length} notifications failed`);
    }

    // 4. Mark subscriptions as expired where calculated end_date < today
    //    (handled per-subscription above; we can't do a simple DB column compare
    //     since end_date is derived, so we update them individually)
    const expiredIds = (subscriptions ?? [])
      .filter((sub: any) => {
        const startMs = new Date(sub.created_at).getTime();
        const endMs = startMs + sub.days * 24 * 60 * 60 * 1000;
        return endMs < todayMs;
      })
      .map((sub: any) => sub.id);

    if (expiredIds.length > 0) {
      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .in("id", expiredIds);
    }

    return new Response(
      JSON.stringify({
        slot,
        processed: active.length,
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
