/**
 * Loads Instagram reply config from JSON file.
 * Edit config/instagram-replies.json and redeploy — no code changes.
 */

import fs from "node:fs";
import path from "node:path";

const CONFIG_PATH = path.resolve("config/instagram-replies.json");

let cached = null;

export function loadReplyConfig() {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    cached = JSON.parse(raw);
    console.log("[IG] Loaded reply config:", cached.rules.length, "rules");
    return cached;
  } catch (e) {
    console.error("[IG] Failed to load reply config:", e.message);
    cached = { rules: [] };
    return cached;
  }
}

export function getReplyRules() {
  return loadReplyConfig().rules;
}

export function findRuleByIntent(intent) {
  return getReplyRules().find(r => r.intent === intent);
}

export function matchIntent(text) {
  const normalized = String(text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (!normalized) return { intent: "default", rule: findRuleByIntent("default") };

  const haystack = ` ${normalized} `;

  // Rules are already in priority order (default last)
  for (const rule of getReplyRules()) {
    for (const keyword of rule.keywords ?? []) {
      const needle = ` ${keyword.toLowerCase()} `;
      if (haystack.includes(needle)) {
        return { intent: rule.intent, rule };
      }
    }
  }

  return { intent: "default", rule: findRuleByIntent("default") };
}

export function renderReply(intent, context = {}) {
  const rule = findRuleByIntent(intent);
  if (!rule) return "Sorry, I couldn't process that.";

  const url = context.url || "https://www.fitfuelnutrition.in";
  let reply = rule.reply || "";

  // Simple placeholder interpolation
  reply = reply.replace(/\{\{url\}\}/g, url);

  // Truncate to 1000 bytes for DMs
  const buf = Buffer.from(reply, "utf8");
  if (buf.length > 1000) {
    const ellipsis = "…";
    const budget = 1000 - Buffer.byteLength(ellipsis);
    reply = buf.subarray(0, budget).toString("utf8").replace(/\uFFFD+$/u, "").trimEnd() + ellipsis;
  }

  return reply;
}