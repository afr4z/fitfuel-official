async function initAuthNav() {
  const navAuth = document.getElementById('nav-auth');
  if (!navAuth) return;

  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.phone) {
        navAuth.innerHTML = `
          <a href="/dashboard" class="nav-link">My Orders</a>
          <button id="btn-logout" class="nav-cta btn-secondary" style="padding:8px 16px;font-size:0.9rem;">Logout</button>
        `;
        document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
        return;
      }
    }
  } catch (e) {
    console.debug('[auth-nav] me check failed:', e);
  }

  navAuth.innerHTML = `<a href="/login" class="nav-cta">Login</a>`;
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  } catch (e) {
    console.error('[auth-nav] logout failed:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthNav);
} else {
  initAuthNav();
}