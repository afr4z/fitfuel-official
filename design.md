# FitFuel Nutrition — Design System (locked)

**genre:** fresh / health-tech · **theme:** reference `swapnow.in` · **system:** this file

Supersedes the editorial system (R2, `board.jpg`) and the warm-consumer system (R1).
This is the owner-requested re-theme ("I don't like this theme — do something else,
try swapnow.in for reference"): an airy gradient ground with floating colour blobs,
glassy surfaces, rounded pills and soft lifts, Inter body over a rounded-geometric
Outfit display. Editorial restraint — squared shoulders, hairline rules, serif
display, deep-green bands — is retired.

**Owner decisions (not preferences):** brand palette locked to the swapnow ramp:
deep teal `#063847`, vivid green `#199e41`, coral `#f78757`, amber `#f9c041`,
indigo `#7272f2` on a `#f6fbf7 → #f4f5ff` ground. Wordmark stays recognizably
`Fit<span class="wordmark-accent">Fuel</span> Nutrition` — a two-tone lockup
("Fuel" in a green→teal gradient, Outfit 800). Plan names render exactly as served
by `/api/plans` — never renamed or split. WhatsApp ordering and web ordering
(OTP → Razorpay) both remain first-class journeys.

---

## 1 · Genre Fingerprint

- Rounded geometry, pills and soft shadows over squared hairline editorial.
- The ground is a fixed gradient with three soft radial colour blobs (indigo,
  green, coral) showing through everywhere — page containers stay transparent.
- Glassy surfaces (`backdrop-filter` blur) for the nav, mobile sheet and footer.
- Uppercase micro-kickers (`HOW IT WORKS`) with `--tracking-caps`, not numerals.
- Deep teal `#063847` is the one dark band — the closing CTA panel — not the hero.
- Accent (coral) carries prices and non-veg marks at display size; small text uses
  the deepened `--color-accent-deep` so contrast holds.
- No photography anywhere — emoji in tinted rounded tiles stand in for images.

## 2 · Macrostructure (per-page family)

| Page | Macro | Note |
| --- | --- | --- |
| `index.html` | **Catalogue** | The menu is the product. Centred statement hero, glass price docket, uniform rounded plan cards that lift on hover, numbered step cards, three-column feature cards, deep-teal closing band. |
| `order.html` | **Narrative Workflow** | Stages `1 → 2 → 3` in the shared progress track. The 3-step wizard *is* the workflow; pill radio toggles. |
| `login.html` | **App page (functional)** | One measured card on the gradient ground. Fields, banners, buttons from `main.css`. No enrichment. |
| `dashboard.html` | **App page (functional)** | Card stack: subscriptions, meals, profile. JS-rendered rows keep whole plan titles. No enrichment. |
| `payment-success.html` | **Letter** | A signed confirmation: gradient check seal, prose, note, actions, signature line. |
| `privacy-policy.html` | **Long Document** | Continuous prose, inline heads, hairline rules. |
| `admin.html` / `bot-messages.html` | **Functional tools** | Secret-gated. Never load the shared nav/footer. Tokens only from `main.css`. |

## 3 · Tokens (single source of truth: `public/css/main.css`)

```css
/* ground & ink — swapnow's ramp */
--color-paper:        #ffffff;   /* text-on-brand, card fills */
--color-paper-2:      #f6fbf7;   /* soft green-white panels */
--color-paper-3:      #eef5f0;
--color-card:         #ffffff;
--color-rule:         #dfe4ec;   /* stroke-soft */
--color-rule-strong:  #b8c2d6;   /* stroke-strong */
--color-ink:          #1a1e2a;   /* text-strong */
--color-ink-display:  #063847;   /* deep teal — display heads */
--color-muted:        #6a7287;
--color-faint:        #94a3b8;

/* brand green (locked — swapnow primary-600) */
--color-brand:        #199e41;
--color-brand-deep:   #127932;
--color-brand-tint:   #e6f4ec;
--color-brand-tint-2: #c3e6cc;

/* coral (locked — swapnow primary-500) — accent only */
--color-accent:         #f78757;
--color-accent-display: #f78757;
--color-accent-deep:    #d95f2b;  /* small text on tint */
--color-accent-tint:    #fff1ea;

/* the field — one deep-teal panel (closing CTA) */
--color-field:       #063847;
--color-field-2:     #04303e;
--color-field-ink:   #ffffff;
--color-field-muted: #b9d4d8;
```

Focus (`--color-focus: #199e41`) is the brand-green offset outline; danger / warn /
success keep their aliases so `admin.html` and `bot-messages.html` resolve
unchanged. The legacy alias block (`--green-*`, `--orange-*`, `--gray-*`,
`--radius-full`, `--shadow-whisper`, `--font`) stays until every consumer is
renamed.

## 4 · Typography (2 faces + outlier wordmark)

- **Display:** `"Outfit"` (self-hosted `outfit-latin-var.woff2`, preloaded). Display
  headlines, section heads, step numerals, the wordmark. Weight 800, tracking
  `-0.02em`, line-height ~1.06.
- **Body / UI:** `"Inter"` (self-hosted `inter-latin-var.woff2`, preloaded). All
  interface, body copy, fields, chips. Weights 400/600/700.
- **Outlier (wordmark):** Outfit 800 — the lockup face, "Fuel" in a green→teal
  text-gradient. The one thing that never drifts between surfaces.

Type scale: `--text-display: clamp(2.5rem, 1.6rem + 4vw, 4rem)`; `--text-3xl` /
`--text-2xl` clamped; `--tracking-caps: 0.12em` for kickers and micro-labels.
Prices use tabular figures (Inter) with `₹` before the number and a muted `/day`
suffix.

## 5 · Space & Geometry

- 4pt scale names (`--space-3xs` → `--space-4xl`) shared with the old system;
  sections breathe: `--space-lg` between cards, `--space-3xl` between bands.
- **Radius:** rounded and friendly. `--radius-sm: 8px`, `--radius-md: 12px`,
  `--radius-lg: 18px`, `--radius-xl: 24px`, `--radius-pill: 999px`. Chips, buttons
  and radio toggles are pills; cards are 12–18px.
- **Depth:** soft, teal-seeded shadows (`--shadow-xs` → `--shadow-lg`), hairline
  borders on cards, hover-lift `translateY(-2px…-4px)` on buttons and interactive
  cards. The primary button carries a green glow.

## 6 · Motion

- Motion-cut stance (matches the 2026 site). One entrance per surface; the only
  repeated animation is the skeleton shimmer and the spinner.
- Nav banner retracts on scroll (N12) — height tapers to 0; never a slide-and-fade
  that fights the user.
- `prefers-reduced-motion: reduce` zeroes all durations and the shimmer.

## 7 · Microinteractions & Voice

- Buttons: pill-shaped. Primary = green gradient + glow + lift; secondary = glass
  white pill with hairline, green border on hover. No shine sweeps.
- Links: pill hover fills in the nav; hairline-free inline links.
- Chips: soft tinted pills — veg = green tint + green dot, non-veg = coral tint +
  coral dot, flag = solid green with white text.
- **CTA voice:** *"Start my plan"* is the one primary action everywhere. Secondary:
  *"See plans & prices"*, *"Order on WhatsApp"*. Confirmation: *"Start this plan"*
  on each catalogue card.

## 8 · What every page MUST share

- Wordmark lockup, the locked tokens, Outfit display + Inter body, the single green
  focus ring, the nav (N12, injected by `nav.js`), the footer (Ft6 letter close),
  the CTA voice, the rounded primitives from `main.css`, and a transparent page
  container so the gradient ground + blobs show through.

## 9 · What pages MAY differ on

- Composition and section order (per macro family above). App pages never use
  enrichment; marketing pages may use emoji tiles and Tier-B art.
- `admin.html` / `bot-messages.html` are exempt from the nav/footer/type rules —
  they are internal tools, gated, token-compatible.

## 10 · Exports / source of truth

- `public/css/main.css` — tokens + shared primitives + footer.
- `public/css/nav.css` — N12 glassy banner + retract styling of the `nav.js` markup.
- `public/js/nav.js` — behavior contract unchanged; markup wraps in `.nav-wrap`
  with a `.nav-banner`.
- `public/fonts/outfit-latin-var.woff2` — display face (self-hosted).
- `public/fonts/inter-latin-var.woff2` — body / UI face (self-hosted).
- Retired with R2: `fraunces-latin-wght-normal.woff2`, the Archivo body face, the
  oklch editorial ramp, numbered section heads, squared buttons, hairline-card
  depth.