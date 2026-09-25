# FitFuel Nutrition — Design System (locked)

**genre:** editorial · **theme:** custom (tuned to `board.jpg`) · **system:** this file

Supersedes the warm-consumer system (R2). This is the dramatic, professional-grade
rebuild: the menu as the product, hairline rules, one deep-green field, type-led
editorial layout. No photography anywhere — the system is built for typography,
shape, and hand-built SVG art.

**Owner decisions (not preferences):** brand palette locked to `board.jpg`
(leaf green, poster orange, deep green). Word markup stays recognizably
`Fit<span class="wordmark-accent">Fuel</span> Nutrition`. Plan names render
exactly as served by `/api/plans` — never renamed or split. WhatsApp ordering and
web ordering (OTP → Razorpay) both remain first-class journeys.

---

## 1 · Genre Fingerprint

- Hairline rules and squared geometry over soft cards and pills.
- Ink is green-tinted; ground is warm cream; the deep-green field is the one
  dramatic band (hero, closing CTA).
- Section heads carry an editorial numeral (`01 —`), not an icon.
- Accent (poster orange) ≤ 5% of any viewport: prices, wordmark accent, non-veg
  marks, flags. Never a button fill, never a band.

## 2 · Macrostructure (per-page family)

| Page | Macro | Note |
| --- | --- | --- |
| `index.html` | **Catalogue** | The menu is the product. Opens in the fold with the price docket; the plan grid is the catalogue; hairline rules everywhere. |
| `order.html` | **Narrative Workflow** | Numbered stages `01 — Plan → 02 — Customize → 03 — Checkout`. The 3-step wizard *is* the workflow. |
| `login.html` | **App page (functional)** | Function carries the page. Centered letterhead card, hairline form. No enrichment. |
| `dashboard.html` | **App page (functional)** | Ledger-style: subscriptions, meals, profile as ruled entries. No enrichment. |
| `payment-success.html` | **Letter** | A signed confirmation: seal, prose, actions, signature line. |
| `privacy-policy.html` | **Long Document** | Continuous prose, inline heads, hairline rules. |
| `admin.html` / `bot-messages.html` | **Functional tools** | Secret-gated. Never load the shared nav/footer. Tokens only from `main.css`. |

## 3 · Tokens (single source of truth: `public/css/main.css`)

```css
/* ground & ink — warm cream, green-tinted ink */
--color-paper:        oklch(97.8% 0.014 90);
--color-paper-2:      oklch(96.4% 0.018 88);
--color-paper-3:      oklch(94% 0.022 88);
--color-card:         oklch(99.2% 0.008 90);
--color-rule:         oklch(89% 0.015 145);
--color-rule-strong:  oklch(78% 0.025 145);
--color-ink:          oklch(24% 0.03 152);
--color-ink-display:  oklch(18% 0.035 152);
--color-muted:        oklch(44% 0.025 145);
--color-faint:        oklch(52% 0.02 145);

/* brand green (locked) */
--color-brand:        oklch(51.9% 0.138 148);
--color-brand-deep:   oklch(27.4% 0.056 153);
--color-brand-tint:   oklch(94.5% 0.032 150);
--color-brand-tint-2: oklch(88% 0.05 150);

/* poster orange (locked) — accent only */
--color-accent:         oklch(55.4% 0.153 44.8);
--color-accent-display: oklch(63.4% 0.168 46.4);
--color-accent-tint:    oklch(94% 0.035 50);

/* the field — deep green band for hero + closing CTA */
--color-field:       oklch(27.4% 0.056 153);
--color-field-2:     oklch(23% 0.05 152);
--color-field-ink:   oklch(97% 0.012 90);
--color-field-muted: oklch(82% 0.025 120);
```

Focus (`oklch(46.4% 0.124 148)`), danger / warn / success keep the warm-consumer
aliases so `admin.html` and `bot-messages.html` resolve unchanged. Legacy alias
block (`--green-*`, `--orange-*`, `--gray-*`, `--radius-full`, `--shadow-whisper`,
`--font`) stays until every consumer is renamed.

## 4 · Typography (2 + outlier)

- **Display:** `"Fraunces Variable"` (self-hosted `fraunces-latin-wght-normal.woff2`,
  preloaded on customer pages). Display headlines, section heads, numerals, the
  letter seal. Weights 600–700, tracking `-0.022em`, line-height ~1.04.
- **Body / UI:** `"Archivo"` (already self-hosted). All interface, body copy,
  fields, chips. Weights 400/600/800.
- **Outlier (wordmark):** Archivo 800 — the lockup face. The wordmark is the one
  thing that never drifts between surfaces.

Type scale (editorial, large display):
`--text-display: clamp(2.4rem, 1.6rem + 4vw, 3.9rem)`; `--text-3xl` / `--text-2xl`
clamped; `--tracking-caps: 0.14em` for kickers and micro-labels.

Prices use tabular figures (Fraunces or Archivo as available) with `₹` before the
number and a muted `/day` suffix.

## 5 · Space & Geometry

- 4pt scale names (`--space-3xs` → `--space-4xl`) shared with the old system;
  editorial pages breathe: `--space-xl` between card and rule, `--space-3xl`
  between bands.
- **Radius:** squared. `--radius-sm: 2px`, `--radius-md: 6px`, `--radius-lg: 12px`.
  `--radius-pill: 9999px` exists for legacy only — chips are small squared tags
  (`--radius-sm`), buttons are squared rectangles.
- **Depth:** flat + hairline. No glow, no big soft shadows. Cards take a hairline
  border and at most `--shadow-xs`; dropdowns take `--shadow-lg` but stay
  hairline-edged.

## 6 · Motion

- Motion-cut stance (matches the 2026 site). One entrance per surface; the only
  repeated animation is the skeleton shimmer and the spinner.
- Nav banner retracts on scroll (N12) — height tapers to 0; never a slide-and-fade
  that fights the user.
- `prefers-reduced-motion: reduce` zeroes all durations.

## 7 · Microinteractions & Voice

- Buttons: squared; hover = solid green fill → darker green (`--color-brand-deep`),
  or hairline → green border. No translateY lift (editorial restraint).
- Links: hairline underline on hover (`--color-brand`), no arrow animation.
- Chips: squared tags; veg = green tint + green dot, non-veg = orange tint + orange
  dot, flag = orange tint text.
- **CTA voice:** *"Start my plan"* is the one primary action everywhere. Secondary:
  *"See plans & prices"*, *"Order on WhatsApp"*. Confirmation: *"Start this plan"*
  on each catalogue card.

## 8 · What every page MUST share

- Wordmark lockup, brand green/orange/deep-green tokens, Fraunces display +
  Archivo body, the single focus ring, the nav (N12, injected by `nav.js`), the
  footer (Ft6 letter close), the CTA voice, the squared/hairline primitives from
  `main.css`.

## 9 · What pages MAY differ on

- Composition and section order (per macro family above). App pages never use
  enrichment; marketing pages may use Tier-B hand-built SVG art.
- `admin.html` / `bot-messages.html` are exempt from the nav/footer/type rules —
  they are internal tools, gated, token-compatible.

## 10 · Exports / source of truth

- `public/css/main.css` — tokens + shared primitives + footer.
- `public/css/nav.css` — N12 banner + retract styling of the `nav.js` markup.
- `public/js/nav.js` — behavior contract unchanged; markup now wraps in
  `.nav-wrap` with a `.nav-banner`.
- `public/fonts/fraunces-latin-wght-normal.woff2` — display face (self-hosted).