/**
 * Instagram webhook handler — Unified Login.
 * Routes: GET /api/instagram (verify), POST /api/instagram (events)
 * Config-driven replies via config/instagram-replies.json
 */

import {
  instagramEnabled,
  requireInstagramConfig,
  sendPrivateReply,
  sendText,
  replyToComment,
} from "../lib/instagram.js";
import {
  matchIntent,
  renderReply,
} from "../lib/instagramReplies.js";
import { safeEqualStrings } from "../lib/timingSafe.js";

function publicCommentRepliesEnabled() {
  return String(process.env.INSTAGRAM_PUBLIC_COMMENT_REPLIES ?? "false").toLowerCase() === "true";
}

async function loadReplyContext() {
  return { url: process.env.APP_URL || "https://www.fitfuelnutrition.in" };
}

function extractEvents(body) {
  const events = [];
  if (body?.object !== "instagram") return events;
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (!change?.value) continue;
      if (change.field === "comments" || change.field === "live_comments") {
        events.push({ kind: "comment", value: change.value });
      } else if (change.field === "messages") {
        events.push({ kind: "message", value: change.value });
      }
    }
    for (const messaging of entry?.messaging ?? []) {
      events.push({ kind: "message", value: messaging });
    }
  }
  return events;
}

async function handleComment(value) {
  const commentId = value.comment_id || value.id;
  const from = value.from ?? {};
  const selfId = process.env.INSTAGRAM_USER_ID;

  if (!commentId) return { skipped: "missing_comment_id" };
  if (!from.id) return { skipped: "missing_author" };
  if (selfId && String(from.id) === String(selfId)) return { skipped: "own_comment" };
  if (value.parent_id) return { skipped: "comment_on_comment" };

  const { intent, rule } = matchIntent(value.text);
  // Only reply if rule exists and has keywords (default rule has no keywords)
  if (!rule || !rule.keywords?.length) return { skipped: "no_intent", intent };

  try {
    const context = await loadReplyContext();
    const body = renderReply(intent, context);

    await sendPrivateReply(commentId, body);

    if (publicCommentRepliesEnabled()) {
      try {
        await replyToComment(commentId, "Sent you a DM 🍽️");
      } catch (e) {
        console.error("[IG] public reply failed:", e.message);
      }
    }

    return { replied: "private_reply", intent };
  } catch (e) {
    console.error(`[IG] comment reply failed for ${commentId}:`, e.message);
    throw e;
  }
}

async function handleMessage(value) {
  const message = value.message ?? {};
  const senderId = value.sender?.id;
  const selfId = process.env.INSTAGRAM_USER_ID;

  if (!senderId) return { skipped: "missing_sender" };
  if (selfId && String(senderId) === String(selfId)) return { skipped: "own_message" };
  if (message.is_echo || message.is_self || message.is_deleted) return { skipped: "echo_or_deleted" };

  try {
    const { intent, rule } = matchIntent(message.text);
    // Default rule (no keywords) still replies to unmatched messages
    const context = await loadReplyContext();
    const body = renderReply(intent, context);

    await sendText(senderId, body);
    return { replied: "dm", intent };
  } catch (e) {
    console.error(`[IG] DM reply failed for ${senderId}:`, e.message);
    throw e;
  }
}

function verifySubscription(req, res, url) {
  const expected = process.env.INSTAGRAM_VERIFY_TOKEN;
  if (!expected) return res.status(500).json({ error: "Verify token not configured" });

  const mode = url.searchParams.get("hub.mode") ?? req.query?.["hub.mode"];
  const token = url.searchParams.get("hub.verify_token") ?? req.query?.["hub.verify_token"];
  const challenge = url.searchParams.get("hub.challenge") ?? req.query?.["hub.challenge"] ?? "";

  if (mode === "subscribe" && safeEqualStrings(String(token ?? ""), expected)) {
    return res.status(200).send(String(challenge));
  }
  return res.status(403).json({ error: "Verification failed" });
}

async function receiveNotification(req, res) {
  if (!instagramEnabled()) return res.status(200).json({ status: "ok", skipped: "disabled" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (!body) return res.status(200).json({ status: "ok", skipped: "empty_body" });

  try {
    requireInstagramConfig();
  } catch (e) {
    return res.status(200).json({ status: "ok", skipped: "not_configured" });
  }

  const results = [];
  let failed = false;

  for (const event of extractEvents(body)) {
    try {
      results.push(
        event.kind === "comment"
          ? await handleComment(event.value)
          : await handleMessage(event.value),
      );
    } catch (e) {
      failed = true;
      results.push({ error: e.message });
    }
  }

  if (failed) return res.status(500).json({ error: "processing_failed", results });
  return res.status(200).json({ status: "ok", processed: results.length, results });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET") return verifySubscription(req, res, url);
  if (req.method === "POST") return receiveNotification(req, res);

  return res.status(405).json({ error: "Method not allowed" });
}