# Design — FitFuel Nutrition

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

Rewrite 2 on branch `hallmark-overhaul`. The previous system (editorial /
broadsheet, `N6` masthead) was **rejected by the owner**; this file supersedes
it. The brand palette is **locked to `board.jpg`** — the leaf green and the
poster orange are a given, not a preference. What changed is everything around
them: the ground is now warm, the shapes are rounded, and the page reads as a
friendly food app instead of a printed poster.

## Genre

`consumer-app` — warm, rounded, tactile.

Reference feel: a polished food / health delivery app (think Swiggy, Zomato,
Noom) rather than a SaaS landing page or a printed sheet. Three rules carry it:

1. **Warm ground.** Paper is cream, never `#fff`, never green-tinted. Cards sit
   *on* the cream in near-white with a soft, warm-tinted shadow.
2. **Rounded shapes.** Radii are generous (10 / 16 / 22px) and controls are
   pills. Nothing is sharp-edged.
3. **One brand colour per moment.** Green is the primary (fills, active
   states); orange is the warm accent (wordmark, prices, non-veg, flags). At no
   point do both hold large fields on the same screen.

Known AI tells that stay banned even though the genre is friendlier: gradient
text, glassmorphism, floating glow orbs, auto-scroll reveals that hide content
without JS, animated counters, emoji as decoration, and duplicated component
CSS across pages.

## Macrostructure family

One base macrostructure per page type. Pages within a family share the shape
and vary only by the listed knobs.

- **Marketing pages:** `3 · Highlight + Docket` — one strong hero (the promise),
  then the docket: How it works, Plans & prices, Why FitFuel, closing band. The
  menu is *content*, presented as its own card in the hero and again as three
  plan cards. Knob: hero variant.
- **App pages:** `01 · Form` — a single measured form/card column. Friendly
  dense, not sparse-spiritual. Function carries the page, and the card chrome
  keeps it reachable.
- **Content pages:** `02 · Long Document` — continuous prose, inline section
  heads, no marketing chrome.

## Nav archetype

`N1a · Sticky brand bar` on every customer page, one density.

- **Left:** compact two-line lockup — wordmark on top, the entity attribution
  underneath. `by Jadpod Fitness Pvt Ltd` is brand-mandated copy and stays in
  the nav on every page.
- **Centre-left:** destinations (`How It Works`, `Plans`, `Why FitFuel`).
- **Right:** the auth slot (signed out = empty) and the `Start my plan` pill.
- **Sticky** with a translucent warm surface and a hairline rule — a consumer
  bar sits with the user, it does not scroll away. `scroll-padding-top` on
  `<html>` keeps in-page anchors clear of it.
- **Mobile:** brand | account chip | burger; the links open as a soft sheet
  under the bar and the CTA pill hides (the hero and closing band carry it).

The nav's *behaviour* contract is non-negotiable and lives in `/js/nav.js`:
APG "disclosure navigation" account menu (hover preview + click pin, Escape
closes and refocuses, click/focus-outside dismisses), the `ff:auth`
sessionStorage first-paint cache, the `<head>` prefetch (`window.__ffAuth`),
and logout. Rewrites change markup classes only, never that logic.

Banned: N3/N1-descendants with a login button (the header shows one action),
masthead treatments, anything not sticky on desktop.

## Footer archetype

`Ft1 · Warm bar` on every page: wordmark + tagline in a left block, 2–4 small
links beside it, a hairline, then the colophon (`© 2026 Jadpod Fitness Private
Limited` + `Secure payments by Razorpay`). Cream ground, no gradient, no link
columns. `/login` stays in the footer — it is the signed-out route now that the
header no longer renders a login control.

Banned: `Ft3` index columns and dark gradient grounds.

## Theme

Custom, brand-locked. Anchor hue **150** (the poster's leaf green), accent hue
**45** (the poster's orange) — measured from `board.jpg`. Neutrals are warm,
leaning to hue ~90 (cream) and ~40 (charcoal); nothing is green-tinted except
green itself.

| Token | Value | Job |
| --- | --- | --- |
| `--color-paper` | `oklch(98.4% 0.014 90)` | base ground — warm cream, never `#fff` |
| `--color-paper-2` | `oklch(95.6% 0.02 90)` | alternate section band |
| `--color-paper-3` | `oklch(93% 0.024 90)` | deepest band / tool ground |
| `--color-card` | `oklch(99.3% 0.006 90)` | card surface on cream |
| `--color-rule` | `oklch(91% 0.014 90)` | hairlines, card borders |
| `--color-rule-strong` | `oklch(82% 0.02 90)` | the one heavier rule per page |
| `--color-ink` | `oklch(25% 0.022 42)` | body text — warm charcoal |
| `--color-ink-display` | `oklch(18% 0.02 42)` | headings |
| `--color-muted` | `oklch(46% 0.024 55)` | secondary text (≥ 4.5:1 on paper) |
| `--color-faint` | `oklch(55% 0.02 55)` | captions and hints (≥ 4.5:1) |
| `--color-brand` | `oklch(51.9% 0.138 148)` | **locked leaf green** — CTA fill, 5.2:1 with paper label |
| `--color-brand-deep` | `oklch(27.4% 0.056 153)` | the closing band's ground |
| `--color-brand-tint` | `oklch(95% 0.03 150)` | selected / hover fills |
| `--color-brand-tint-2` | `oklch(89.5% 0.05 150)` | accent chips, step tracks |
| `--color-accent` | `oklch(55.4% 0.153 44.8)` | **locked poster orange** — text-safe |
| `--color-accent-display` | `oklch(63.4% 0.168 46.4)` | display-only orange (≥ 24px) |
| `--color-accent-tint` | `oklch(95% 0.03 45)` | peach fills |
| `--color-focus` | `oklch(46.4% 0.124 148)` | focus ring |
| `--color-danger` | `oklch(48% 0.17 27)` | errors |
| `--color-danger-tint` | `oklch(95% 0.03 27)` | error banner fill |

### The green/orange contract

- **Green is primary.** It fills CTAs, the active nav accent, progress fills,
  veg chips, the closing band, and success marks. It may hold large areas.
- **Orange is the warm accent.** Reserved for the wordmark's `Fuel`, prices,
  non-veg chips, "Most popular" flags and numbered step tokens. It never fills
  a button and never takes a whole band.
- **No gradient anywhere** — including on buttons. Depth is shadow, warmth is
  colour.
- Shadows are warm-tinted (`oklch(35% 0.02 60 / α)`) and soft; cards carry
  `--shadow-md`, floating panels carry `--shadow-lg`. Never a coloured glow.

## Typography

- Display: **Archivo** 700–800 (width axis ~102–108%), self-hosted variable
  latin-subset woff2.
- Body: **Inter** 400–600, same file convention.
- Headline scale is friendly, not monumental: `--text-display:
  clamp(2.25rem, 1.2rem + 4vw, 3.25rem)`. Section heads `clamp(1.875rem, 1.4rem
  + 2vw, 2.5rem)`.
- Body copy sits at `1rem`/`1.125rem` with `1.6` line-height; muted text is
  never lighter than `--color-muted`.
- Display tracking `-0.02em`; small caps lines `0.12em`, uppercase, weight 700.
- Every display rule carries `overflow-wrap: anywhere; min-width: 0` (audit
  #11). No italics — emphasis is weight or colour (`font-style: normal`).

## Spacing

4-point named scale, ten steps. Pages use named tokens only — never raw px.

```css
--space-3xs: 0.125rem; --space-2xs: 0.25rem; --space-xs:  0.5rem;
--space-sm:  0.75rem; --space-md:  1rem;    --space-lg:  1.5rem;
--space-xl:  2.5rem;  --space-2xl: 4rem;    --space-3xl: 6rem;
--space-4xl: 9rem;
```

Section rhythm is **not** uniform: the closing band breathes tighter than the
section above it, and cards inside a section use `--space-lg` gaps (audit #5).

## Motion

- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`; `--dur-short: 180ms`;
  `--dur-med: 280ms`. No bounce, no elastic, no overshoot.
- Hover may **lift 2px** on interactive cards (a consumer-app affordance) and
  darken fills; buttons press 1px down on `:active`. No glow, no scale.
- **No scroll-triggered reveals.** Content is present on load (audit #8).
  Sticky nav gets no scroll listener; its surface is constant.
- Reduced motion: opacity-only, ≤ 150ms.

## CTA voice

- **Primary:** solid `--color-brand` pill, `--color-paper` label, weight 600,
  `min-height: 44px` (36px in the nav). Hover darkens one step (`--color-focus`)
  and lifts 1px. `transform: none` when `:disabled` (opacity 0.55).
- **Secondary:** outlined pill, `--color-ink` (12% rule) border on card/paper,
  tinted fill on hover. One definition, shared by every page — in
  `/css/main.css`, never redeclared per page (audit #4).

## App-page primitives (all shared, all in `/css/main.css`)

`.card` (near-white, `--radius-lg`, hairline + `--shadow-md`), `.field-label`,
`.field-input` / `.field-textarea` (rounded 14px, focus = global ring),
`.field-error`, `.banner-error` / `.banner-success` / `.banner-note`,
`.spinner`, `.chip` (rounded status pill, `.chip-veg` green / `.chip-nonveg`
orange), `.progress` track + `.progress-fill` (rounded, green). Pages compose
with these; they do not re-declare them.

## What pages MUST share

- The wordmark: `Fit<span class="wordmark-accent">Fuel</span> Nutrition` — one
  component, never retyped; `Fuel` is orange.
- The nav lockup (`by Jadpod Fitness Pvt Ltd`) and the `Ft1` warm-bar footer.
- Archivo + Inter, the CTA voice, the shared primitives.
- `overflow-x: clip` on **both** `html` and `body` (audit #12); focus ring on
  the global `:where(...)` rule.
- `<html>` `scroll-padding-top` sized to the sticky bar.

## Page inventory

| Page | Type | Nav | Footer | Shape |
| --- | --- | --- | --- | --- |
| `/` | marketing | N1a | Ft1 | 3 Highlight + Docket |
| `/login` | app | N1a | Ft1 | 01 Form, single card |
| `/order` | app | N1a | Ft1 | 01 Form, 3-step wizard |
| `/dashboard` | app | N1a | Ft1 | 01 Form, card stack |
| `/payment-success` | app | N1a | Ft1 | 01 Form, single card |
| `/privacy-policy` | content | N1a | Ft1 | 02 Long Document |
| `/admin` | internal | none | none | 05 Workbench (secret-gated) |
| `/bot-messages` | internal | none | none | 02 Long Document (secret-gated) |

Internal tools never load the shared nav (pre-existing decision). They load
`/css/main.css` for tokens and primitives; they stay out of the customer
surface.

## Preserved by contract

Non-negotiable across the overhaul:

- **Route trees, API handlers, auth, Razorpay, and all data flow are not design
  surface.** The nav's APG disclosure account menu, the `ff:auth` sessionStorage
  cache, the head-prefetch, Escape-to-close and focus-return all keep working.
- **Plan titles are customer-facing and are not renamed or split.** They come
  from the database; the design wraps them, it does not rewrite them (the
  `/order` plan-title/emoji split that shipped earlier was reverted).
- **Entity attribution stays.** `by Jadpod Fitness Pvt Ltd` in the nav,
  `© 2026 Jadpod Fitness Private Limited` in the footer.
- **No photography.** The system is typography-and-shape by construction.

## Exports

`public/css/main.css` is the `tokens.css` of this project — the `:root` block is
the token source of truth, plus the shared primitives. `/css/nav.css` + `/js/nav.js`
are the single nav component. `public/index.html` carries no shared class
redefinition, exactly one `.btn-primary`, and page composition only.