// FitFuel Nutrition — shared HTML-escaping for values interpolated into
// innerHTML templates (audit S6/S7: DOM XSS via unescaped server/user data).
// Loaded synchronously before the page's main inline script on pages that
// render API data into templates (dashboard, order, admin, nav).
//
// Escape order matters: & first. Also escapes quotes so values are inert in
// both text content and double-quoted attribute contexts.
function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}
