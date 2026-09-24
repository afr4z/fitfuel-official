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

  // "Order Now" is suppressed only where it is self-referential: on /order
  // it would just reload the checkout. Kept everywhere else, including the
  // dashboard. Arrow (not a checkmark): it points into the order flow,
  // matching "View Plans ↓". Decorative, so hidden from AT.
  const cta = isOrder
    ? ""
    : `<a href="/order" class="nav-cta">Order Now
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
        </svg>
      </a>`;

  placeholder.innerHTML = `
    <nav class="nav" id="nav" aria-label="Primary">
      <div class="nav-inner">
        <a href="/" class="nav-brand">Fit<span class="wordmark-accent">Fuel</span> Nutrition <span class="nav-sub">by Jadpod Fitness Pvt Ltd</span></a>
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

  // ── Auth-aware rendering ────────────────────────────────────────────
  const authEl = document.getElementById("nav-auth");
  if (!authEl) return;

  // Outlined secondary control (not a nav link): one filled primary ("Order
  // Now") is the only high-emphasis action in the header.
  const loginLink = () =>
    `<a href="/login" class="nav-login"${current(isLogin)}>Login</a>`;

  // Static pages get a sensible default first (no flash)
  authEl.innerHTML = loginLink();

  // Greeting for the signed-in nav. The name is server data, so it is
  // built with textContent — never innerHTML (see docs/audit.md S6).
  // Falls back to "Hi there" for customers who signed up by phone only.
  function greetingNode(name) {
    const first =
      typeof name === "string" ? name.trim().split(/\s+/)[0] || "" : "";
    const el = document.createElement("span");
    el.className = "nav-greeting";
    const hi = document.createElement("span");
    hi.className = "nav-greeting-hi";
    hi.textContent = "Hi, ";
    const who = document.createElement("span");
    who.className = "nav-greeting-name";
    who.textContent = first || "there";
    el.append(hi, who);
    return el;
  }

  async function renderAuth() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.phone) {
          // Single Meals sits behind login (account-gated feature).
          authEl.innerHTML = `
            <a href="/single-meals" class="nav-link">Single Meals</a>
            <a href="/dashboard" class="nav-link"${current(isDashboard)}>My Orders</a>
            <button type="button" id="btn-logout" class="nav-logout">Logout</button>
          `;
          authEl.prepend(greetingNode(data.name));
          document
            .getElementById("btn-logout")
            ?.addEventListener("click", handleLogout);
          return;
        }
      }
    } catch (e) {
      console.debug("[nav] auth me check failed:", e);
    }
    authEl.innerHTML = loginLink();
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
