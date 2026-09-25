# Design — FitFuel Nutrition

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

Written by a `hallmark` run on branch `hallmark-overhaul`. The brand palette is
**locked to `board.jpg`** — it is a given, not a preference. The *structure* was
rebuilt from first principles because the audit found the nav and footer were the
default AI archetypes.

## Genre

`editorial`

The brand board is a poster: flat ground, one wide heavy two-tone mark, a
letterspaced line, a faint leaf watermark. That is a broadsheet, not a SaaS
landing page. Every decision below serves "printed page on screen".

## Macrostructure family

One base macrostructure per page type. Pages within a family share the shape and
vary only by the listed knobs.

- **Marketing pages:** `11 · Catalogue` — the page is an index of inventory. FitFuel
  sells a *menu*, so the menu is the spine and everything else annotates it.
  Knobs: hero variant, section count.
- **App pages:** `05 · Workbench` (density-first) — one measure, labelled fields,
  hairline-ruled rows, no enrichment, no reveal. Function carries the page.
  Knobs: measure width, row density.
- **Content pages:** `02 · Long Document` — continuous prose, inline section heads,
  no marketing chrome.

## Nav archetype

`N6 · Newspaper masthead` on every page, in two densities.

- **Full** (marketing): large centred wordmark, letterspaced attribution line, double rule.
- **Compact** (app + content): wordmark steps down one size, attribution line stays,
  double rule stays. Same vocabulary, less height.

The masthead line is the real entity attribution — **`by Jadpod Fitness Pvt Ltd`**.
It is brand-mandated copy, not decoration, and it is the reason N6 fits: a masthead
is exactly where an attribution belongs.

Banned for this project: `N1`/`N1a` (the AI nav — this is the fingerprint the audit
flagged critical), `N5` (modern-minimal vocabulary), `N7` (fights the restraint).

## Footer archetype

- **Ft1 · Mast-headed** on marketing — wordmark anchors one horizontal band, tagline
  beside it, 2–3 small links, attribution below. Paper ground, double rule above.
- **Ft2 · Inline-rule single line** on app + content — one line of credits, hairline above.

Banned: `Ft3` index columns (the AI footer — the other critical finding), `Ft8`
(kinetic, wrong genre).

The old footer's dark-green gradient is deleted. It was simultaneously the Ft3
fingerprint and a large colour field fighting the accent budget.

## Theme

Custom, brand-locked. Anchor hue **150** (the poster's leaf green), derived from
`board.jpg` and measured, not guessed. Accent hue **45** (the poster's orange).

| Token | Value | Job |
| --- | --- | --- |
| `--color-paper` | `oklch(97.5% 0.011 150)` | base surface — a tinted paper, never `#fff` |
| `--color-paper-2` | `oklch(94.6% 0.014 150)` | alternate ground, table zebra |
| `--color-rule` | `oklch(86% 0.010 150)` | hairlines, double rules |
| `--color-rule-strong` | `oklch(74% 0.012 150)` | the one heavier rule per page |
| `--color-ink` | `oklch(22% 0.012 152)` | body text — deep, faintly green-black |
| `--color-ink-display` | `oklch(16% 0.010 152)` | headings |
| `--color-muted` | `oklch(46% 0.010 150)` | secondary text (≥ 4.5:1 on paper) |
| `--color-faint` | `oklch(58% 0.009 150)` | captions only, never body |
| `--color-accent` | `oklch(55.4% 0.153 44.8)` | **text-safe** orange, 5.08:1 on paper |
| `--color-accent-display` | `oklch(63.4% 0.168 46.4)` | large display only (≥ 24px), 3.68:1 |
| `--color-brand` | `oklch(51.9% 0.138 148)` | brand green — CTA fill, 5.21:1 with paper label |
| `--color-brand-deep` | `oklch(27.4% 0.056 153)` | the closing band's ground |
| `--color-focus` | `oklch(46.4% 0.124 148)` | focus ring |

### The accent/fill contract

This is the rule that resolves audit finding #15, where green and orange had
swapped jobs.

- **`--color-brand` green is a structural colour, not the accent.** It may hold a
  large area only as the poster's dark ground (`--color-brand-deep`) on the closing
  band. It is never a decorative fill.
- **`--color-accent` orange is the accent, capped at 3% of a viewport.** It appears
  only as: the wordmark's `Fuel`, kickers, prices, step numerals, the active nav
  marker, and link underlines on hover. That is the whole budget.
- **No gradient anywhere.** The old footer gradient is gone; the old green button
  glow is gone. Depth is weight and scale, not shadow.

## Typography

- Display: **Archivo**, weight 700–800, style `roman`, width axis 108% for the mark.
- Body: **Inter**, weight 400–600.
- Two families, both self-hosted latin-subset variable woff2. No third-party request.
- Display tracking: `-0.02em` on headings, `0.18em` on the letterspaced caps line.
- Type scale anchor: `--text-display: clamp(2.75rem, 6.5vw, 4.5rem)`.
- All display type is `font-style: normal`. Emphasis is carried by weight or accent,
  never italics.
- Every display rule carries `overflow-wrap: anywhere; min-width: 0` (audit #11).

Archivo is a grotesk, not a serif, and that is deliberate: the brief's own mark is a
*wide heavy grotesque*. A serif would fight the brand board. What makes it read
editorial is the weight discipline and the letterspaced caps line, not the classification.

## Spacing

4-point named scale, ten steps. Pages use named tokens only — never raw px.

```css
--space-3xs: 0.125rem; --space-2xs: 0.25rem; --space-xs:  0.5rem;
--space-sm:  0.75rem; --space-md:  1rem;    --space-lg:  1.5rem;
--space-xl:  2.5rem;  --space-2xl: 4rem;    --space-3xl: 6rem;
--space-4xl: 9rem;
```

Section rhythm is **not** uniform: the closing band is tighter than the section
above it, and the hero's bottom padding exceeds its top (audit #5).

## Motion

- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`; `--dur-short: 180ms`;
  `--dur-med: 280ms`. No overshoot, no bounce, no elastic anywhere.
- **Reveal: one orchestrated hero entrance, nothing else.** The 23 scroll-triggered
  fade-ups are deleted (audit #8). Sections are present on load.
- Reduced motion: opacity-only, ≤ 150ms.

## Microinteractions stance

- Hover changes **colour and rules only** — never translate, never scale, never a
  coloured glow (audit: gate 13, gate 23).
- `active` may shift 1px down. No lift.
- No toasts. No celebration. No cursor followers. No auto-rotating anything.
- The nav-link underline animates `transform: scaleX()`, never `width` (audit #7).
- Focus ring is instant — it never fades in.

## CTA voice

- **Primary:** solid `--color-brand` pill, `--color-paper` label, weight 600, no
  glow, no gradient. Hover = one step darker. `padding: 0 var(--space-lg)`,
  `min-height: 44px`.
- **Secondary:** outlined pill, `--color-rule-strong` border that darkens on hover.
  One definition, shared by every page — the homepage's divergent copy is deleted
  (audit #4).
- Pills are permitted. Gradients on pills are not.

## Per-page allowances

- Marketing pages MAY use Tier-A CSS art (the leaf watermark) and Tier-B SVG.
- App pages MUST NOT use enrichment, reveal animation, or marketing bands.
- Content pages: typography only.

## What pages MUST share

- The wordmark: `Fit<span class="wordmark-accent">Fuel</span> Nutrition` — one
  component, never retyped.
- The accent colour and its ≤ 3% placement.
- Archivo + Inter, and the letterspaced caps line.
- The CTA voice above.
- The `N6` double rule and the `Ft1`/`Ft2` hairline.
- `overflow-x: clip` on **both** `html` and `body` (audit #12).

## What pages MAY differ on

- Masthead density: full on marketing, compact on app + content.
- Footer: `Ft1` on marketing, `Ft2` on app + content.
- Macrostructure within the declared family.
- Measure width on prose pages.

## Page inventory

| Page | Type | Macrostructure | Nav | Footer |
| --- | --- | --- | --- | --- |
| `/` | marketing | 11 Catalogue | N6 full | Ft1 |
| `/login` | app | 05 Workbench | N6 compact | Ft2 |
| `/order` | app | 05 Workbench | N6 compact | Ft2 |
| `/dashboard` | app | 05 Workbench | N6 compact | Ft2 |
| `/payment-success` | app | 05 Workbench | N6 compact | Ft2 |
| `/bot-messages` | app | 05 Workbench | N6 compact | Ft2 |
| `/admin` | app (internal) | 05 Workbench | N6 compact | Ft2 |
| `/privacy-policy` | content | 02 Long Document | N6 compact | Ft2 |

## Preserved by contract

Non-negotiable across the overhaul:

- **Route trees, API handlers, auth, Razorpay, and all data flow are not design
  surface.** The nav's APG disclosure account menu, the `ff:auth` sessionStorage
  cache, the head-prefetch, Escape-to-close and focus-return all keep working.
- **Plan titles are customer-facing and are not renamed.** They come from the
  database; the design wraps them, it does not rewrite them.
- **Entity attribution stays.** `by Jadpod Fitness Pvt Ltd` in the masthead,
  `© 2026 Jadpod Fitness Private Limited` in the footer.
- **No photography.** The system is typography-first by construction.

## Exports

`public/css/main.css` is the `tokens.css` of this project — the `:root` block is
the token source of truth, in the names below.
