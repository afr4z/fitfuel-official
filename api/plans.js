import { getPlanCategories } from "../lib/mealPlans.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const plans = await getPlanCategories();
    return res.status(200).json({ plans });
  } catch (err) {
    console.error("[PLANS] Error:", err.message, err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
}