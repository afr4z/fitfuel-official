/**
 * Instagram Graph API client — Unified Login (graph.facebook.com).
 * Minimal: send DM, private reply to comment, public reply to comment.
 */

const DEFAULT_API_VERSION = "v26.0";
const MAX_MESSAGE_BYTES = 1000;
const MAX_CAPTION_CHARS = 2200;

export class InstagramError extends Error {
  constructor(message, { code = null, status = null } = {}) {
    super(message);
    this.name = "InstagramError";
    this.code = code;
    this.status = status;
  }
  get isAuthError() {
    return [10, 102, 190, 200, 253, 294].includes(this.code);
  }
}

export function apiBaseUrl() {
  return `https://graph.facebook.com/${process.env.INSTAGRAM_API_VERSION || DEFAULT_API_VERSION}`;
}

export function igUserId() {
  return process.env.INSTAGRAM_USER_ID;
}

export function instagramEnabled() {
  return String(process.env.INSTAGRAM_ENABLED ?? "true").toLowerCase() !== "false";
}

export function requireInstagramConfig() {
  const missing = [];
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) missing.push("INSTAGRAM_ACCESS_TOKEN");
  if (!process.env.INSTAGRAM_USER_ID) missing.push("INSTAGRAM_USER_ID");
  if (missing.length) throw new InstagramError(`Missing: ${missing.join(", ")}`);
}

export function truncateToBytes(text, maxBytes = MAX_MESSAGE_BYTES) {
  const buf = Buffer.from(String(text ?? ""), "utf8");
  if (buf.length <= maxBytes) return text;
  const ellipsis = "…";
  const budget = Math.max(0, maxBytes - Buffer.byteLength(ellipsis));
  return buf.subarray(0, budget).toString("utf8").replace(/\uFFFD+$/u, "").trimEnd() + ellipsis;
}

function extractErrorCode(err) {
  return err?.error?.code ?? err?.error?.error_code ?? null;
}

async function graph(path, { method = "GET", body, token, query } = {}) {
  const accessToken = token || process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) throw new InstagramError("INSTAGRAM_ACCESS_TOKEN not set");

  const url = new URL(`${apiBaseUrl()}/${String(path).replace(/^\/+/, "")}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    throw new InstagramError(`Network error: ${e.message}`);
  }

  const raw = await res.text();
  let parsed = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = { raw }; }

  if (!res.ok) {
    console.error("[IG] API error:", res.status, raw.slice(0, 500));
    throw new InstagramError(
      parsed?.error?.message || `API failed (${res.status})`,
      { code: extractErrorCode(parsed), status: res.status },
    );
  }
  return parsed;
}

export async function sendText(igsid, text) {
  const igId = igUserId();
  if (!igId) throw new InstagramError("INSTAGRAM_USER_ID not set");
  return graph(`${igId}/messages`, {
    method: "POST",
    body: { recipient: { id: igsid }, message: { text: truncateToBytes(text) } },
  });
}

export async function sendPrivateReply(commentId, text) {
  const igId = igUserId();
  if (!igId) throw new InstagramError("INSTAGRAM_USER_ID not set");
  return graph(`${igId}/messages`, {
    method: "POST",
    body: { recipient: { comment_id: commentId }, message: { text: truncateToBytes(text) } },
  });
}

export async function replyToComment(commentId, message) {
  return graph(`${commentId}/replies`, {
    method: "POST",
    body: { message: truncateToBytes(message, MAX_CAPTION_CHARS) },
  });
}