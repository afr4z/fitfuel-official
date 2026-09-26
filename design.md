# FitFuel Nutrition — Design System (locked)

**genre:** warm consumer · **theme:** board-derived produce palette · **system:** this file
**hero archetype:** H2 split diptych · **nav:** link-row bar · **footer:** 3-block

Supersedes the bone/forest clinical rebuild (R3) and the editorial build (R2). The
owner preferred the original warm consumer app (R1) over both, so this system
**builds on R1** rather than replacing it: R1's scale, warm pricing rows and colour
energy are kept, and the fixes listed in § 2 are layered on top.

**Owner decisions (not preferences):** the produce palette from `board.jpg` is
locked — leaf green, poster orange, and the greys that lean warm with them. Word
markup stays `Fit<span class="wordmark-accent">Fuel</span> Nutrition`. Plan names
come from `/api/plans` and are never renamed; the order card presents a title in
two typographic registers (first word as a word-tile, the remainder as the name)
while the control's `aria-label` carries the **whole** title. WhatsApp ordering and
web ordering (OTP → Razorpay) both remain first-class.

---

## 1 · What the system is

- **Warm, not cold.** Paper is white and warm-grey; ink is a deep produce green
  (`--green-900`), never black. Orange appears where the system *means* something:
  the kicker, the step numerals, every price, the hero menu's top rule.
- **Type:** Archivo (variable, 62.5–125% width axis) for display and the wordmark,
  Inter for UI and body. Both self-hosted and preloaded. The width axis is a real
  art-direction lever and is used deliberately, not left at default.
- **Scale contrast is the point.** A display h1 at up to 3.5rem against 1rem body
  copy; the hero is two balanced lines, not three with a stranded last word.
- **Sections breathe:** 80px block padding, 960px content measure, hairline rules
  (`--green-100`/`--green-200`) instead of card chrome.
- **Motion:** scroll-reveal on section children (staggered, `--reveal-delay-*`),
  a pulsing status dot, and a 0.3s reveal on the hero. Nothing loops forever.

## 2 · What this build changed on top of R1

| Fix | Why |
| --- | --- |
| **One drawn motif replaces the leaf wallpaper** | R1's repeating leaf read as texture, not identity. The mark is now a **plate divided into three** — breakfast, lunch, dinner, the product's actual promise. It appears at three scales: a small mark on the menu card, one inline on the pricing note, and large and whole on the closing band. |
| **The two drifting orbs are gone** | The closing band carried two `float-orb` gradients on 15s/18s infinite loops. The plate mark now occupies that space, and it means something. |
| **Section heads are two-column and left-aligned** | Every head was centred over left-aligned bodies — the accidental-mismatch tell, and the reason the page read as a stack of identical centred bands. The head now sits over the content it introduces. |
| **The "Why" grid is 2 columns, not 3×2** | Breaks the repetition of the four-up steps above and the single-column plans below. |
| **h1 uses the width axis** | `font-stretch: 94%` keeps the display size but breaks the headline onto two balanced lines. |
| **The footer's redundant "Explore" column is gone** | It repeated the nav links verbatim. What remains: brand block, Your account, Get in touch. |
| **Mobile: plan price rows wrap** | R1's four `nowrap` price groups are ~330px wide; below 480px they pushed the document **99px wide** — the whole page scrolled sideways on a phone. The label now stacks above and the groups wrap. |
| **The four app pages got a footer** | R1 shipped a footer on the homepage only. Order, login, dashboard and payment-success ended abruptly: no legal colophon, no Privacy link, no Login route for signed-out visitors. |
| **The order page got an `<h1>`** | It opened straight into the progress tracker — no page title on the page that matters most. |
| **Focus rings are real outlines** | R1 killed `outline` and substituted a `box-shadow` halo, which vanishes in Windows High Contrast Mode, on `:focus` rather than `:focus-visible`. Now a 2px `outline`, offset, never animated. |
| **No `transition: all`** | Nine sites named their properties instead, so focus and visibility changes are instant. |
| **The order radio has an accessible name** | The card is `role="radio"` *and* contains a real radio input — the input had no label at all. It now carries the full title. |
| **Odd plan counts don't strand a card** | Three plans in a two-column grid left the last at half width; `:last-child:nth-child(odd)` takes the full row. |

## 3 · Tokens (`public/css/main.css`)

```css
/* produce ramp — locked to board.jpg */
--leaf:      #2f9e44;   /* the poster green: graphics, tints, rules */
--green-50:  #f2f9f3;  --green-100: #e2f2e5;  --green-200: #c4e5cb;
--green-300: #96d1a3;  --green-400: #5ab373;
--green-500: #1a7d36;   /* deep leaf: filled buttons with white labels */
--green-600: #166b2d;  --green-700: #145c27;  --green-800: #123f22;
--green-900: #0d2f1a;   /* display ink */

--orange-50:  #fef3ec;  --orange-100: #fde2cf;
--orange-400: #f59a3d;
--orange-500: #ee701c;  /* large display only (3:1) */
--orange-600: #d96217;  --orange-700: #b84e0f;  /* small text (4.5:1) */

--gray-50 … --gray-900;  /* warm-leaning neutrals */
--radius-sm: 8px; --radius-md: 10px; --radius-lg: 16px; --radius-full: 9999px;
```

Two greens with distinct jobs: the bright `--leaf` cannot carry white button text
at AA, so filled buttons use `--green-500`. Two oranges likewise: `--orange-500`
is display-only, small text uses `--orange-600`/`--orange-700`.

## 4 · Chrome

- **Nav** — wordmark with the brand-mandated `by Jadpod Fitness Pvt Ltd`
  attribution inline (it drops below 900px), three anchors, the auth slot, and one
  filled CTA. The CTA is suppressed on `/order` and `/dashboard` where it is
  redundant. Account menu keeps the APG disclosure behaviour.
- **Footer** — brand block with the trust badge, "Your account", "Get in touch",
  and a bottom row with the legal colophon. Every customer page now carries it.

## 5 · The class contract

`/css/main.css` owns the shared primitives every page composes against; each page
styles only its own composition. Customer pages: `container · page-head ·
page-title · page-lead · progress · progress-step · step-label · card · card-title
· card-subtitle · form-input · form-textarea · otp-input · plan-grid · plan-option
· plan-emoji · plan-name · plan-tag · plan-desc · step · step-num · feature ·
features-grid · menu · footer · wordmark-accent`. `admin.html` and
`bot-messages.html` stay secret-gated and token-compatible.

## 6 · Photography

Three supporting photographs sit in the plan bands, beside the pitch, with the
order action under each. They are **CC0 1.0 public-domain stock used as
placeholders** — *not* photographs of FitFuel meals — sourced through the
[Openverse](https://openverse.org) API. `public/img/CREDITS.md` records the
creator, source page and alt text for every file.

**Before launch, replace them with your own kitchen photography.** The
filenames are stable and content-agnostic (`plan-high-protein-320.webp` …), so
dropping in real 4:3 crops at the same sizes is the whole swap.

Rules the markup follows, so replacing a file needs no code change:

| | |
| --- | --- |
| Format | WebP, quality 80 |
| Variants | 320w and 640w for a 220px card (1× / 2×) |
| `srcset` + `sizes="220px"` | the browser picks; a phone fetches ~16–28 KB |
| `width` / `height` | declared, so the card never reflows as images land |
| `loading="lazy"` | every plan image is below the fold, so the LCP stays the h1 |
| `aspect-ratio: 4/3` + `object-fit: cover` | any crop renders the same shape |
| `alt` | describes the photograph, never claims it is the customer's meal |

## 7 · Fonts

- `public/fonts/archivo-latin-var.woff2` — display + wordmark (variable, width axis)
- `public/fonts/inter-latin-var.woff2` — UI + body (variable)
- Retired by the earlier builds and no longer referenced: `fraunces-*`,
  `outfit-*`, `cabinet-grotesk-*`, `switzer-*`, `geist-mono-var-*`. They remain on
  disk; deleting them needs owner sign-off.
