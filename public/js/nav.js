// FitFuel Nutrition — shared auth-aware nav (single component, one file)
// Usage on any page:
//   <div id="nav-placeholder"></div>
//   <script src="/js/nav.js" defer></script>
// The component injects the full nav (brand, links, auth state) into the placeholder.

(function () {
  const placeholder = document.getElementById("nav-placeholder");
  if (!placeholder) return;

  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const isOrder = path === "/order";
  const isLogin = path === "/login";
  const isDashboard = path === "/dashboard";

  const current = (active) => (active ? ' aria-current="page"' : "");

  // One action, one name: "Start my plan" is the label in the hero, the
  // banner and here. Suppressed where it is redundant — on /order it
  // would only reload the checkout, and on /dashboard the page has its
  // own order button. The arrow is decorative, so hidden from AT.
  const hideCta = isOrder || isDashboard;
  const cta = hideCta
    ? ""
    : `<a href="/order" class="nav-cta">Start my plan
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
        </svg>
      </a>`;

  placeholder.innerHTML = `
    <nav class="nav" id="nav" aria-label="Primary">
      <div class="nav-inner">
        <a href="/" class="nav-brand">Fit<span class="wordmark-accent">Fuel</span> Nutrition</a>
        <button class="nav-burger" id="nav-burger" aria-label="Open menu" aria-controls="nav-links" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <div class="nav-links" id="nav-links">
          <a href="/#how-it-works" class="nav-link">How It Works</a>
          <a href="/#plans" class="nav-link">Plans</a>
          <a href="/#why" class="nav-link">Why FitFuel</a>
          <div class="nav-actions">
            <div id="nav-auth" class="nav-auth"></div>
            ${cta}
          </div>
        </div>
      </div>
    </nav>
  `;

  const burger = document.getElementById("nav-burger");
  const links = document.getElementById("nav-links");
  const navEl = document.getElementById("nav");

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

  // Close after picking a destination (mobile pattern — no sticky overlay).
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

  // ── Sticky scroll effect (single source of truth) ───────────────────
  window.addEventListener(
    "scroll",
    () => {
      navEl?.classList.toggle("scrolled", window.scrollY > 20);
    },
    { passive: true },
  );

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
             fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div class="nav-account-menu" id="nav-account-menu" hidden>
        <a href="/dashboard" class="nav-account-item"${current(isDashboard)}>My Orders</a>
        <a href="/single-meals" class="nav-account-item">Single Meals</a>
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

  // Outlined secondary control (not a nav link): one filled primary ("Order
  // Now") is the only high-emphasis action in the header.
  const loginLink = () =>
    `<a href="/login" class="nav-login"${current(isLogin)}>Login</a>`;

  // Hold the slot with a neutral placeholder instead of painting "Login"
  // and swapping it out — that read as a flash of the wrong auth state.
  authEl.setAttribute("aria-busy", "true");
  authEl.innerHTML = `<span class="nav-auth-skeleton" aria-hidden="true"></span>`;

  async function renderAuth() {
    let signedIn = false;
    let name = "";
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.phone) {
          signedIn = true;
          name = data.name;
        }
      }
    } catch (e) {
      console.debug("[nav] auth me check failed:", e);
    }

    if (signedIn) {
      // Account menu is the last item — the right edge of the bar.
      authEl.replaceChildren(accountMenu(name));
    } else {
      authEl.replaceChildren();
      authEl.insertAdjacentHTML("beforeend", loginLink());
    }
    authEl.removeAttribute("aria-busy");
  }

  async function handleLogout() {
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
