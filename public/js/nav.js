// FitFuel Nutrition — shared auth-aware nav (single component, one file)
// Usage on any page:
//   <div id="nav-placeholder"></div>
//   <script src="/js/nav.js" defer></script>
// The component injects the full nav (brand lockup, links, auth state,
// CTA) into the placeholder.
//
// Behaviour contract (do not regress — this is the whole point of the
// component):
//   - APG "disclosure navigation" account menu: opens on hover for mouse
//     users AND on click/Enter/Space for touch and keyboard; hover only
//     previews, a click pins; Escape closes and returns focus; click or
//     focus moving outside dismisses.
//   - `ff:auth` sessionStorage cache: last known state paints immediately,
//     /me revalidates on every load regardless.
//   - `window.__ffAuth` head prefetch is consumed when the page started
//     one; a fetch here is only the fallback for pages without it.
//   - Logout: cache cleared first, POST /api/auth/logout, redirect "/".
// Rewriting this file changes markup classes only, never the logic above.

(function () {
  const placeholder = document.getElementById("nav-placeholder");
  if (!placeholder) return;

  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const isOrder = path === "/order";
  const isDashboard = path === "/dashboard";

  const current = (active) => (active ? ' aria-current="page"' : "");

  // One action, one name: "Start my plan" is the label in the hero, the
  // banner and here. Suppressed where it is redundant — on /order it
  // would only reload the checkout, and on /dashboard the page has its
  // own order button. Hidden by CSS under the mobile breakpoint. The
  // arrow is decorative, so hidden from AT.
  const hideCta = isOrder || isDashboard;
  const cta = hideCta
    ? ""
    : `<a href="/order" class="nav-cta">Start my plan
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
        </svg>
      </a>`;

  // N12 · Banner + retract. The banner strip carries the brand kicker;
  // the edge bar carries the lockup, links, auth slot and CTA. One
  // sticky wrapper holds both; the banner retracts on scroll (listener
  // below). The wordmark locks left, attribution beneath — brand-
  // mandated copy that stays on every page.
  placeholder.innerHTML = `
    <div class="nav-wrap" id="nav-wrap">
      <div class="nav-banner" id="nav-banner">
        <p class="nav-banner-text">
          <span class="nav-banner-kicker">Nutrition made delicious</span>
          <span class="nav-banner-divider" aria-hidden="true">·</span>
          <span>fresh meals, every day</span>
        </p>
      </div>
      <nav class="nav" id="nav" aria-label="Primary">
        <div class="nav-inner">
          <a href="/" class="nav-brand">
            <span class="nav-brand-name">Fit<span class="wordmark-accent">Fuel</span> Nutrition</span>
            <span class="nav-brand-attrib">by Jadpod Fitness Pvt Ltd</span>
          </a>
          <ul class="nav-links" id="nav-links">
            <li><a href="/#how-it-works" class="nav-link">How It Works</a></li>
            <li><a href="/#plans" class="nav-link">Plans</a></li>
            <li><a href="/#why" class="nav-link">Why FitFuel</a></li>
          </ul>
          <div class="nav-actions">
            <div id="nav-auth" class="nav-auth"></div>
            ${cta}
            <button class="nav-burger" id="nav-burger" aria-label="Open menu" aria-controls="nav-links" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  `;

  // N12 · Banner retract — the strip collapses out of the way once the
  // page scrolls, leaving the edge bar at full height. Purely additive:
  // it touches no auth or menu logic, and the global reduced-motion cut
  // already zeroes the transition for users who ask for it.
  const navWrap = document.getElementById("nav-wrap");
  if (navWrap) {
    const onNavScroll = () =>
      navWrap.classList.toggle("nav-scrolled", window.scrollY > 8);
    onNavScroll();
    window.addEventListener("scroll", onNavScroll, { passive: true });
  }

  const burger = document.getElementById("nav-burger");
  const links = document.getElementById("nav-links");

  // ── Mobile menu ──────────────────────────────────────────────────────
  function setMenu(open) {
    if (!links || !burger) return;
    links.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  burger?.addEventListener("click", () => {
    setMenu(!links?.classList.contains("open"));
  });

  // Close after picking a destination (mobile pattern — the sheet is not
  // an overlay).
  links?.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });

  // Escape bails out of the open menu and returns focus to the burger.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && links?.classList.contains("open")) {
      setMenu(false);
      burger?.focus();
    }
  });

  // Clean up a mid-state menu if the viewport grows past the breakpoint.
  const mq = window.matchMedia("(max-width: 820px)");
  const onViewport = (e) => {
    if (!e.matches) setMenu(false);
  };
  if (mq.addEventListener) mq.addEventListener("change", onViewport);
  else mq.addListener(onViewport); // legacy Safari

  // ── Account menu ──────────────────────────────────────────────────
  // Disclosure pattern (W3C APG "disclosure navigation"), not role="menu":
  // these are links to pages, so they stay plain links in a list.
  // Opens on hover for mouse users AND on click/Enter/Space for touch and
  // keyboard — USWDS is explicit that hover must never be the only way in.
  function accountMenu(name) {
    const first =
      typeof name === "string" ? name.trim().split(/\s+/)[0] || "" : "";
    const who = first || "there";

    const el = document.createElement("div");
    el.className = "nav-account";
    // Static template only — no interpolation. The name is server data and
    // is set with textContent below, never innerHTML (audit.md S6).
    el.innerHTML = `
      <button type="button" class="nav-account-trigger" id="nav-account-trigger"
              aria-expanded="false" aria-controls="nav-account-menu">
        <span>Hi, <span class="nav-account-name"></span></span>
        <svg class="nav-account-chevron" width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div class="nav-account-menu" id="nav-account-menu" hidden>
        <a href="/dashboard" class="nav-account-item"${current(isDashboard)}>My Orders</a>
        <hr class="nav-account-sep" />
        <button type="button" class="nav-account-item nav-account-logout" id="btn-logout">Logout</button>
      </div>
    `;
    el.querySelector(".nav-account-name").textContent = who;
    wireAccountMenu(el);
    return el;
  }

  function wireAccountMenu(el) {
    const trigger = el.querySelector(".nav-account-trigger");
    const menu = el.querySelector(".nav-account-menu");
    let closeTimer;
    // Hover only *previews* the menu. A click pins it so moving the
    // pointer away no longer dismisses it; without this, hovering then
    // clicking (the normal mouse path) toggled the preview shut.
    let pinned = false;

    const isOpen = () => trigger.getAttribute("aria-expanded") === "true";
    const setOpen = (open) => {
      trigger.setAttribute("aria-expanded", String(open));
      menu.hidden = !open;
    };
    const close = (refocus) => {
      pinned = false;
      setOpen(false);
      if (refocus) trigger.focus();
    };

    trigger.addEventListener("click", () => {
      if (isOpen() && !pinned) {
        pinned = true; // hover had it open — pin, don't slam it shut
        return;
      }
      if (isOpen() && pinned) {
        close();
        return;
      }
      pinned = true; // touch / keyboard: open and stay open
      setOpen(true);
    });

    // Hover is a mouse-only enhancement. The panel lives inside this
    // element, so moving the pointer onto it keeps it open (WCAG 1.4.13).
    el.addEventListener("mouseenter", () => {
      clearTimeout(closeTimer);
      if (!pinned) setOpen(true);
    });
    el.addEventListener("mouseleave", () => {
      if (pinned) return;
      closeTimer = setTimeout(() => setOpen(false), 150);
    });

    // Escape closes and returns focus — required for 1.4.13.
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) close(true);
    });
    document.addEventListener("click", (e) => {
      if (isOpen() && !el.contains(e.target)) close();
    });
    document.addEventListener("focusin", (e) => {
      if (isOpen() && !el.contains(e.target)) close();
    });

    el.querySelector("#btn-logout")?.addEventListener("click", handleLogout);
  }

  // ── Auth-aware rendering ────────────────────────────────────────────
  const authEl = document.getElementById("nav-auth");
  if (!authEl) return;

  // Last known auth state, per tab. /me is revalidated on every page load
  // regardless, so this is only ever a first paint: it stops the control
  // visibly flipping on every navigation, it is not a source of truth.
  // sessionStorage rather than localStorage so it dies with the tab and
  // cannot leak a signed-in identity into other tabs.
  //
  // The signed-out answer is cached too, not just the greeting. Most visits
  // are signed out, so caching only "Hi, Name" would leave the majority of
  // visitors with a placeholder on every single page. A null name means
  // "resolved, and the answer was signed out", which is distinct from no
  // entry at all, which means "we have not asked yet".
  const AUTH_CACHE_KEY = "ff:auth";

  function readAuthCache() {
    try {
      const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      return value && typeof value === "object" && "name" in value
        ? value
        : null;
    } catch {
      return null; // private mode / storage disabled
    }
  }

  function writeAuthCache(name) {
    try {
      sessionStorage.setItem(
        AUTH_CACHE_KEY,
        JSON.stringify({ name: name || null }),
      );
    } catch {}
  }

  function clearAuthCache() {
    try {
      sessionStorage.removeItem(AUTH_CACHE_KEY);
    } catch {}
  }

  function showSignedIn(name) {
    authEl.classList.add("nav-auth-account");
    authEl.replaceChildren(accountMenu(name));
  }

  // Signed out, the auth slot renders nothing at all. A "Login" pill in the
  // header is a second competing call to action next to "Start my plan", and
  // signing in is a returning-customer task, not something to advertise to
  // first-time visitors. The footer still links to /login, and the route is
  // unchanged, so existing customers are not locked out.
  function showSignedOut() {
    authEl.classList.remove("nav-auth-account");
    authEl.replaceChildren();
  }

  async function renderAuth() {
    // Paint what we last knew straight away. With no cache we do not know yet,
    // and the slot is empty when signed out anyway, so there is nothing to
    // reserve and no placeholder to flash.
    const cached = readAuthCache();
    if (cached && cached.name) showSignedIn(cached.name);
    else showSignedOut();

    let signedIn = false;
    let name = "";
    // Prefer the prefetch kicked off in the page <head>, which overlaps the
    // API round trip with the rest of the document. Fall back to fetching
    // here if the page did not start one (or it failed).
    let data = null;
    try {
      // A resolved prefetch is authoritative even when it is null: null
      // there means "the server said 401", not "no prefetch ran". Only
      // fetch here when the page never started one, otherwise every
      // logged-out visit would pay for two round trips.
      if (window.__ffAuth) {
        data = await window.__ffAuth;
      } else {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) data = await res.json();
      }
    } catch (e) {
      console.debug("[nav] auth me check failed:", e);
    }

    if (data && data.phone) {
      signedIn = true;
      name = typeof data.name === "string" ? data.name : "";
    }

    if (signedIn) {
      writeAuthCache(name);
      // Only touch the DOM if the revalidated state actually differs, so a
      // repeat visit leaves the control (and any open menu) untouched.
      if (!cached || cached.name !== name) showSignedIn(name);
    } else {
      writeAuthCache(null);
      // Render unless we are already showing the signed-out control from
      // cache. `cached.name` truthy means the cache claimed we were signed
      // in, so that has to be corrected.
      if (!cached || cached.name) showSignedOut();
    }
    authEl.removeAttribute("aria-busy");
  }

  async function handleLogout() {
    // Drop the cached state first: the redirect below re-enters this nav,
    // and a stale greeting would otherwise paint before /me corrects it.
    clearAuthCache();
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      window.location.href = "/";
    } catch (e) {
      console.error("[nav] logout failed:", e);
    }
  }

  renderAuth();
})();