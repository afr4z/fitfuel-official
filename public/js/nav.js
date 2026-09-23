// FitFuel Nutrition — shared auth-aware nav (single component, one file)
// Usage on any page:
//   <div id="nav-placeholder"></div>
//   <script src="/js/nav.js" defer></script>
// The component injects the full nav (brand, links, auth state) into the placeholder.

(function () {
  const placeholder = document.getElementById("nav-placeholder");
  if (!placeholder) return;

  const NAV_HTML = `
    <nav class="nav" id="nav">
      <div class="nav-inner">
        <a href="/" class="nav-brand">Fit<span class="accent">Fuel</span> Nutrition <span class="nav-sub">by Jadpod Fitness Pvt Ltd</span></a>
        <button class="nav-burger" id="nav-burger" aria-label="Menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        <div class="nav-links" id="nav-links">
          <a href="/#how-it-works" class="nav-link">How It Works</a>
          <a href="/#plans" class="nav-link">Plans</a>
          <a href="/#why" class="nav-link">Why FitFuel</a>
          <div id="nav-auth" class="nav-auth"></div>
          <a href="/order" class="nav-cta">Order Now</a>
        </div>
      </div>
    </nav>
  `;

  placeholder.innerHTML = NAV_HTML;

  // ── Mobile menu toggle ──────────────────────────────────────────────
  const burger = document.getElementById("nav-burger");
  const links = document.getElementById("nav-links");
  burger?.addEventListener("click", () => {
    const open = links?.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(!!open));
  });

  // ── Sticky scroll effect (single source of truth) ───────────────────
  const navEl = document.getElementById("nav");
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

  // Static pages get a sensible default first (no flash)
  authEl.innerHTML = `<a href="/login" class="nav-link nav-login">Login</a>`;

  async function renderAuth() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.phone) {
          authEl.innerHTML = `
            <a href="/dashboard" class="nav-link">My Orders</a>
            <button id="btn-logout" class="nav-logout" style="border:none;background:none;color:var(--gray-600);font-size:0.8rem;font-weight:600;padding:8px 12px;cursor:pointer;transition:color 0.2s;">Logout</button>
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
    authEl.innerHTML = `<a href="/login" class="nav-link nav-login">Login</a>`;
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
