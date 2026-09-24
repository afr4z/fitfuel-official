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

  // "Order Now" is the checkout's own CTA — linking /order → /order is a
  // pointless reload, so drop it while the user is on the order page.
  const cta = isOrder ? "" : '<a href="/order" class="nav-cta">Order Now</a>';

  placeholder.innerHTML = `
    <nav class="nav" id="nav" aria-label="Primary">
      <div class="nav-inner">
        <a href="/" class="nav-brand">Fit<span class="accent">Fuel</span> Nutrition <span class="nav-sub">by Jadpod Fitness Pvt Ltd</span></a>
        <button class="nav-burger" id="nav-burger" aria-label="Open menu" aria-controls="nav-links" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <div class="nav-links" id="nav-links">
          <a href="/#how-it-works" class="nav-link">How It Works</a>
          <a href="/#plans" class="nav-link">Plans</a>
          <a href="/#why" class="nav-link">Why FitFuel</a>
          <div id="nav-auth" class="nav-auth"></div>
          ${cta}
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

  const loginLink = () =>
    `<a href="/login" class="nav-link nav-login"${current(isLogin)}>Login</a>`;

  // Static pages get a sensible default first (no flash)
  authEl.innerHTML = loginLink();

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
