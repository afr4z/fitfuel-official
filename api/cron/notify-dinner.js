import { createClient } from "@supabase/supabase-js";
import notifySlot from "../../lib/notifySlot.js";

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
    const result = await notifySlot("dinner");
    return res.status(200).json(result);
  } catch (err) {
    console.error("[CRON/dinner]", err);
    return res.status(500).json({ error: err.message });
  }
}
