# FitFuel Nutrition — Design System (locked)

**genre:** modern-minimal · **theme:** custom (tuned) · **macrostructure:** Split Studio
**vibe:** *clinical calm, quiet luxury, bone and leaf* · **system:** this file

Supersedes the swapnow-influenced build (gradient ground, floating blobs, glassy
surfaces, pill-everything, Outfit + Inter) and the editorial build before it
(Fraunces + Archivo, squared shoulders, hairline editorial). The owner rejected
both and asked for Hallmark; this is the third and current system.

The thesis: **the menu is a clinical document.** A nutrition brand can earn
premium trust by refusing decoration and showing the arithmetic — every plan a
real price sheet, every number derived from the live price table, one dark band,
one action. Restraint is the aesthetic.

**Owner decisions (not preferences):** brand palette anchored on the FitFuel
green, used as a *highlighter* only (focus rings, active states, the wordmark
accent, veg markers) — never a large fill. Wordmark stays recognizably
`Fit<span class="wordmark-accent">Fuel</span> Nutrition` in solid green (the
gradient-text lockup is retired; gradient text is banned). Plan names render
exactly as served by `/api/plans` — never renamed or split. WhatsApp ordering and
web ordering (OTP → Razorpay) both remain first-class journeys.

---

## 1 · What this build refuses

Every one of these was present in a prior build or is a known AI tell, and is
now banned system-wide:

| Refused | Why |
| --- | --- |
| Gradient ground + floating colour blobs | The aurora-blob default; reads as generated |
| Glassmorphism (nav, cards, footer) | Decoration without communicative purpose |
| Gradient text (the wordmark's green→teal) | The single loudest AI tell |
| Pill-shaped everything | Shape variety collapsed into one silhouette |
| Emoji as feature icons | OS-rendered, breaks the type system's voice |
| 3-up icon-above-heading card grid | The default feature template |
| Link-row nav (N1/N1b) + announcement banner | The documented AI-nav fingerprint |
| Invented metrics / testimonials | Dishonest; every number here is derived from the price table |
| Inter / system-ui as body | On the skill's ban list |

## 2 · Genre fingerprint

- **Flat, quiet, data-forward.** Borders and hairlines, not shadows. Depth is
  weight and scale.
- **Bone ground** (`oklch(97% 0.008 88)`), forest-black ink, tight radii (3–14px).
  Pills appear nowhere by default.
- **The accent is a highlighter.** ≤ 3% of any viewport: focus ring, active nav
  state, wordmark accent, veg dot, the "Most popular" chip.
- **Roman display type only.** Emphasis via weight or colour — never italics.
- **One eyebrow per page** (the hero kicker). Section heads are plain stacked
  pairs; no tag-left/header-right, no chapter numbering.
- **The one dark band** is the closing CTA. Everything else is bone.

## 3 · Macrostructure (per-page family)

| Page | Macro | Note |
| --- | --- | --- |
| `index.html` | **Split Studio** | Hero diptych (statement \| price board) → three alternating plan bands (pitch \| F3 spec sheet) → savings strip → step sequence → protocol list → dark closing band |
| `order.html` | **Narrative Workflow** | 1 → 2 → 3 shared progress track; compact form primitives |
| `login.html` | **App page (functional)** | One measured card on the bone ground; OTP fields share the 44px base height |
| `dashboard.html` | **App page (functional)** | Card stack; JS-rendered rows keep whole plan titles; chips are instrument tags |
| `payment-success.html` | **Letter** | Brand-tinted check seal, headline, tinted note, revealed actions |
| `privacy-policy.html` | **Long Document** | One measure, hairline section rules, legal copy verbatim |
| `admin.html` / `bot-messages.html` | **Functional tools** | Secret-gated. No shared nav/footer. Token-compatible via the legacy alias block |

## 4 · Tokens (source of truth: `public/css/main.css`)

```css
/* paper + panels — warm bone, every neutral chroma-tinted (≥ 0.005) */
--color-paper:   oklch(97%   0.008 88);
--color-paper-2: oklch(94.5% 0.01  88);
--color-paper-3: oklch(91%   0.012 90);
--color-card:    oklch(99.2% 0.006 88);

/* ink */
--color-ink:         oklch(21% 0.012 95);   /* 16.2:1 on paper */
--color-ink-display: oklch(27% 0.035 158);  /* deep forest-black */
--color-muted:       oklch(46% 0.014 95);   /* 6.5:1 */
--color-faint:       oklch(50% 0.014 95);   /* 5.5:1 — instrument labels */

/* rules — hairline · panel border · UI boundary (3.3:1) */
--color-rule:        oklch(88% 0.008 90);
--color-rule-mid:    oklch(82% 0.01  90);
--color-rule-strong: oklch(62% 0.014 92);

/* the one accent — highlighter only */
--color-brand:        oklch(55% 0.14  150);
--color-brand-deep:   oklch(44% 0.12  152);  /* 6.7:1 — small text on tint */
--color-brand-tint:   oklch(94% 0.035 148);
--color-brand-tint-2: oklch(88% 0.05  148);

/* second accent — muted clay: non-veg marks only */
--color-accent:       oklch(58% 0.12 42);
--color-accent-deep:  oklch(46% 0.11 42);
--color-accent-tint:  oklch(94% 0.03 52);
--color-accent-tint-2:oklch(88% 0.05 55);

/* the one dark band */
--color-field:       oklch(25% 0.035 162);
--color-field-ink:   oklch(96% 0.006 110);
--color-field-muted: oklch(76% 0.02  150);

--color-focus: oklch(50% 0.18 150);          /* 5.1:1 on paper */
```

Every pair above was contrast-checked with a WCAG script before shipping. No pure
`#fff` / `#000`; no zero-chroma neutral; no inline colour outside the token block.

## 5 · Typography (three faces — the ceiling)

- **Display — Cabinet Grotesk** 700/800 (self-hosted). An editorial grotesque:
  crisp, slightly condensed, decisively *not* a rounded geometric like the
  retired Outfit. Wordmark, h1–h4, plan names, price figures, stat numbers.
- **Body — Switzer** 400/500/600 (self-hosted). All prose and UI. Replaces Inter
  (banned as a default).
- **Instrument register — Geist Mono** 400–600 (self-hosted). One role, applied
  consistently: kickers, table headers, tenure labels, step numbers, the price
  ladder, footer credit. This is the Cobalt-style mono-as-data-register, not a
  decorative outlier.

Scale is a 1.25 major third off 16px. Display tracking `-0.025em`; caps tracking
`0.12em`; body measure 45–75ch (`--measure: 65ch` default, 48ch in the hero).
All prices and table figures are `tabular-nums`.

## 6 · Geometry, depth, motion

- Radius: 3 / 6 / 10 / 14 / 999 (`--radius-sm` → `--radius-pill`). Pills are
  opt-in only; nothing in the system uses one by default.
- Depth: one whisper shadow for overlays only (`--shadow-lg` on the account
  menu). Panels use a 1px `--color-rule-mid` border and no resting shadow.
- Motion-cut. Transitions name their properties (never `transition: all`), run
  120–300ms on exponential ease-out, and animate only `transform`/`opacity`
  (the progress bar's `width` is the one functional exception). The skeleton
  shimmer is the only looping animation. `prefers-reduced-motion` collapses
  spatial motion and slows the loaders.

## 7 · Chrome

- **Nav — N9 edge-aligned minimal.** Wordmark (with the brand-mandated
  `by Jadpod Fitness Pvt Ltd` attribution) hard-left; the auth slot and the one
  CTA hard-right; the space between is the design. No link row, no banner, no
  burger — the bar is one row at every width, and the wordmark returns home from
  every app page. The signed-in account chip keeps the full APG disclosure
  behaviour (hover preview, click pin, Escape, outside-click/focus dismissal).
- **Footer — Ft2 inline single line.** One row under a hairline: wordmark +
  tagline · three links (Login · Privacy Policy · WhatsApp Us) · `© 2026 Jadpod
  Fitness Private Limited. All rights reserved.` + Razorpay trust. All six
  customer pages share it byte-for-byte in behaviour and render it on one line.
  `/login` stays linked from the footer — it is the only route for signed-out
  visitors now that the header has no link row.

## 8 · Microinteractions & voice

- Primary button = **ink-filled** (never accent-filled); secondary = outlined
  with a 3:1 UI-strength border that turns brand-green on hover. Tight 6px
  shoulders, 44px hit target, labels never wrap.
- Chips are instrument tags: mono, small caps, tinted, with a 6px dot. Veg =
  brand green, non-veg = clay, flag = solid `--color-brand-deep`.
- Focus is a first-class state: one green `outline: 2px` ring, offset, never
  animated, on every focusable element.
- **CTA voice:** *"Start my plan"* is the one primary action everywhere.
  Secondary: *"See plans & prices"*, *"Start this plan"*, *"Order on WhatsApp"*.
- Copy stays honest: the savings strip's `27%` is `₹240 → ₹175` on the Weight
  Loss plan, `₹175` is the real lowest per-meal price, and `1–3` is the real
  meals-per-day range from the product copy. No testimonials, no invented proof.

## 9 · Exports / source of truth

- `public/css/main.css` — tokens, primitives, the Ft2 footer, focus + motion
  policy, the class inventory every page composes against.
- `public/css/nav.css` — N9 nav styling of the `nav.js` markup.
- `public/js/nav.js` — behaviour contract unchanged (APG menu, `ff:auth` cache,
  head prefetch, logout); only the injected markup changed for N9.
- `public/fonts/` — Cabinet Grotesk 700/800, Switzer 400/500/600, Geist Mono
  variable. All self-hosted, preloaded, `font-display: swap`.
- Retired: Outfit, Inter, Fraunces, Archivo, the gradient ground + blobs, glass
  surfaces, the pill language, the letter-close footer, the announcement banner.
