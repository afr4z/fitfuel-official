# FitFuel Security & Overhaul Audit

Status last refreshed: **2026-09-24** (security hardening rounds 1–2 + S6/S7 XSS landed).

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| P0-1 | Admin API dead (500): bad imports + router mismatch | 🔴 | ✅ **FIXED** `74a4291` — imports `../lib`, `?path=` fallback |
| P0-2 | `/single-meals` dead link | 🟠 | ⏸ **DECISION:** leave as-is (placeholder) |
| P1 | No favicon | 🟡 | ⏸ **DECISION:** leave as-is |
| **S1** | No OTP rate limit / lockout | 🔴 | ✅ **FIXED** (R2) — Upstash throttle, 5/day, 5-attempt lockout |
| **S2** | `Math.random` OTP/session/magic tokens | 🔴 | ✅ **FIXED** (R2) — `crypto.randomInt` / `randomBytes` |
| **S3** | OTP logged in plaintext | 🔴 | ⏸ **DECISION:** keep (PII logging fine in dev) |
| **S4** | Magic-login-by-reference session forgery | 🔴 | ✅ **FIXED** (R2) — high-entropy `magic_` token |
| **S5** | No CSP / security headers | 🟠 | ❌ **OPEN** — vercel.json has no headers block |
| **S6** | DOM XSS via innerHTML (server/user data) | 🟠 | ✅ **FIXED** `a2a9eb4` — `js/esc.js`, all sinks escaped, runtime-verified |
| **S7** | Admin secret exfil via S6 + sessionStorage | 🟠 | ✅ **CLOSED** via S6 (no XSS sink remains); token stays in sessionStorage |
| **S8** | Webhook no paid-amount assert | 🟠 | ✅ **FIXED** (R2) |
| LOW | Admin `!==` compare | 🟡 | ✅ **FIXED** (R2) — `lib/timingSafe.js` |
| LOW | Webhook logs phone + magic token | 🟡 | ✅ **DEFERRED** (S3 decision) — magic token now random, phones kept for dev |
| LOW | Session 30d TTL | 🟡 | ✅ **FIXED** (R2) — 14d + sliding refresh |
| LOW | Webhook double-create window | 🟡 | ✅ **FIXED** (R2) — unique index live & enforced |
| §3 | A11y: reduced-motion / contrast / aria | 🟠 | 🔶 **PARTIAL** — reduced-motion on 5/6 pages + main.css; contrast + aria open |
| §4 | Render-blocking Google Fonts (6 weights) | 🟠 | ❌ **OPEN** |
| §4 | Duplicated inline `<style>` per page | 🟡 | ❌ **OPEN** |
| §4 | Zero cache headers | 🟡 | ❌ **OPEN** |
| §3 | admin.html + bot-messages.html off main.css/nav.css | 🟡 | ❌ **OPEN** |
| §6 | Stale `database_current.sql` | 🟡 | ❌ **OPEN** |

---

ope reviewed: public/ (all 8 pages + nav.js + both CSS files), api/ (auth, web-order, public, admin, razorpay-webhook, webhook), lib/ (addresses, deliveryDays, cronUtils, whatsapp, sendNotification), vercel.json, bot/session.js, live DB probes, and live production endpoints.
Verification method: claims from independent skill-grounded reviews were re-checked against the actual code and live system. Several reviewer findings were refuted (called out in §8) — they would have led the overhaul astray.

1. What is broken in production right now
   🔴 P0-1. Admin panel is completely dead (HTTP 500) — ✅ FIXED `74a4291`
   api/admin.js imports from ../../lib/_ and ../../bot/_ — but the file lives in api/, so those resolve outside the repo (/home/afr4z/git/lib/...). Every other API uses ../lib/_. Verified live:
   GET /api/admin/plan-defaults → 500 FUNCTION_INVOCATION_FAILED
   GET /api/admin/kitchen-closed → 500 FUNCTION_INVOCATION_FAILED
   So the kitchen-closed editor and plan-defaults admin page cannot load in production. Two compounding bugs:
   Import paths (api/admin.js:2-6): ../lib/ → ../../lib/, ../bot/ → ../../bot/.
   Router mismatch (api/admin.js:28-29 vs api/auth.js:207): auth.js uses url.searchParams.get("path") || url.pathname (Vercel rewrites append the wildcard as ?path=), but admin.js only checks url.pathname (e.g. /api/admin/kitchen-closed) — which after the /api/admin/:path_ rewrite is /api/admin.js?path=.... Even with imports fixed, admin.js would 404. It needs the same fallback auth.js has.
   🟠 P0-2. "Single Meals" is a dead link everywhere — ⏸ DECISION: leave as-is
   public/js/nav.js:22, index.html hero + CTA + footer (:994, :1278, :1452) all link to /single-meals — but there is no single-meals.html and no vercel.json rewrite. Verified live: GET /single-meals → 404. Since you're mid-overhaul, decide: build the page (it's a bot feature already) or remove the links.
   🟡 P1. No favicon — ⏸ DECISION: leave as-is
   GET /favicon.ico → 404, and no <link rel="icon"> on any page. Trivial win.
2. Security (verified in code)
   🔴 HIGH

# Finding Where

S1 No rate limiting / lockout on OTP — ✅ FIXED (R2). send-otp and verify-otp are unthrottled: no per-phone/IP counter, no attempts tracking, no backoff. Attacker loops 6-digit guesses within the 300s window and, when it expires, re-calls send-otp (also unlimited → WhatsApp SMS-flood to any number). Account takeover as any customer (read subs/addresses, place orders, own profile/addresses). api/auth.js:332-397 (no limiter anywhere)
S2 OTP and session tokens generated via Math.random() — ✅ FIXED (R2), CSPRNG. api/auth.js:13-15 (OTP), :105-109 (session), :33 (magic token)
S3 OTP logged in plaintext with phone + template — ⏸ DECISION: keep (fine in dev). api/auth.js:348 console.log("[AUTH] Sending OTP:", { to, templateName, otp })
S4 Magic-login-by-reference is a de-facto session-forgery vector — ✅ FIXED (R2), high-entropy magic token. api/auth.js:281-303, public/payment-success.html:327-336
🟠 MEDIUM

# Finding Where

S5 No CSP or security headers anywhere — ❌ OPEN. vercel.json (whole file)
S6 DOM XSS via innerHTML with server data — ✅ FIXED `a2a9eb4`. dashboard.html:561,565,583,593; order.html:944-956, 1045-1050, 1424-1436; admin.html:385-501
S7 Admin bearer token stored in sessionStorage and rendered page built by innerHTML (S6) → any XSS on admin.html exfiltrates the admin secret — ✅ CLOSED via S6. admin.html
S8 Webhook never asserts paid amount against expected amount — ✅ FIXED (R2). api/razorpay-webhook.js:195-238
🟡 LOW
Admin secret compared with plain !== — ✅ FIXED (R2), lib/timingSafe.js.
Webhook logs phone numbers and even the magic token — ✅ DEFERRED with S3 (magic token now random, low risk).
Session cookie is HttpOnly; Secure; SameSite=Lax ✅ — ✅ FIXED (R2): 14-day TTL + sliding refresh.
Webhook idempotency — ✅ FIXED (R2): unique index on razorpay_payment_id applied live and enforced (verified 23505 via VPS SSH).
3. Frontend / UX / accessibility
Preselect plan links work ✅ (verified — see §8). Not a bug.
A11y gaps (real):
- 🔶 PARTIAL — reduced-motion guard now on index, order, login, dashboard, payment-success + main.css (admin/bot-messages still lack it). Contrast + aria still open.

- Contrast: --gray-400 #9ca3af as body/help text on white ≈ 2.9:1 (fails AA); --green-400 #46a97a text on white ≈ 3.3:1. Use --gray-500/--green-600 for text.
- Order/dashboard's plan "radio" cards and step progress have no live aria-checked/aria-valuenow; keyboard path is uneven.
  Consistency debt (the main overhaul driver): every page re-declares .btn-primary, spinners, banners, and page chrome inline; bot-messages.html and admin.html don't use main.css/nav.css at all → two or three visual dialects of the same site. Design tokens exist in main.css — extend, don't duplicate.

4. Performance
   Render-blocking Google Fonts (6 weights) on every page — ❌ OPEN. Self-host a variable Inter or load async. Highest visible win.
   ~30–38KB duplicated inline <style> per page — ❌ OPEN. index.html 933 CSS lines, order.html 461, etc. Uncacheable, re-sent every visit.
   Zero caching headers — ❌ OPEN. vercel.json has no headers block, so /css/_ and /js/_ ship max-age=0, must-revalidate. Simple Cache-Control + hashed filenames is a free win.
   /me is fine — it's Promise.all of 4 independent queries (auth.js:416-423), not sequential, and no N+1 on meals (auth.js:178-199 single .in() query). Reviewer claim refuted (§8).
   Webhook chain is sequential (~7 happy-path round-trips + WhatsApp) — fine at current volume; parallelize post-insert notifications later.
   No service worker, no image assets to optimize (heroes are CSS gradients) — skip.
5. API design
   Good contracts: consistent {error} shape, sane codes (400/401/404/405/409), server-side price recomputation (web-order.js:120-125), phone taken from session never body (:77), saved-address ownership checked with both id + customer_id (:133-138, no IDOR), and no DB writes before payment (:146-149). Webhook verifies Razorpay HMAC over JSON.stringify(req.body) correctly. Keep all of this.
   Admin router mismatch (P0-1) is the one contract bug — ✅ FIXED (same 74a4291).
   Route-file sprawl: 6 discrete api/\*.js each building their own supabase client and URL parse — Not urgent, deferred to overhaul.
6. Observability & ops
   Logs are ad-hoc console.log with PII/OTP leakage (S3, webhook phones). No request IDs, no structured logging, no error reporting integration.
   database_current.sql is stale — ❌ OPEN. Stale dump shows zero indexes; live DB has them. Refresh/replace before anyone bases a migration on it.
   For the overhaul, add a minimal logger (method, path, status, duration, request id) and a real error sink; verify then alert on webhook failures.
7. Priority overhaul plan (implementation status)
   Round 1 — stop the bleeding: ✅ admin.js imports + router fallback done (`74a4291`). ⏸ single-meals + favicon deemed non-issues (placeholder pages, leave as-is). ❌ CSP + cache headers STILL OPEN.
   Round 2 — auth hardening: ✅ COMPLETE (`221082c`, `6ecafbe`, `f57eef4`). All except S3 (OTP/PII logging retained by decision). Unique index applied live + enforced.
   Round 3 — frontend consolidation: 🔶 PARTIAL — DOM XSS killed (`a2a9eb4`); shared CSS/JS extraction, fonts, a11y still open.
   Round 4 — cleanups: ❌ database_current.sql, logging standardization still open.
8. Corrections to reviewer claims (verified false)
9. "Preselect plan links never match" — false. Verified live tags (healthy*nonveg, high_protein_veg, …) pass through planToSlug = tag.toLowerCase().replace(/*/g,"-") → healthy-nonveg which exactly matches index.html's /order?plan=healthy-nonveg. Works today.
10. "/me makes N+1 / sequential queries (upsert fails → address_id null)" — false. /me is Promise.all; live upsert probe with the exact production path succeeded (dedupe confirmed). The unique constraint exists live.
11. "Pay cheap → get expensive plan (payment tampering)" — not exploitable in the current flow: price is computed server-side from DB pricing, baked into the Razorpay link amount, and the webhook verifies the signature. The paid-amount assert (S8) is defense-in-depth, not a live hole.
12. "Webhook re-delivery creates duplicate subscriptions" — largely mitigated by clearSession before the notify/magic steps; only a currently-empty throw window could double-create. Add the unique index; don't treat as active.