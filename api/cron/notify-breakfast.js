import notifySlot from "../../lib/notifySlot.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await notifySlot("breakfast");
    return res.status(200).json(result);
  } catch (err) {
    console.error("[CRON/breakfast]", err);
    return res.status(500).json({ error: err.message });
  }
}
