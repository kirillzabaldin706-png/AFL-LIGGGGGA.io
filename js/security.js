// ============================================
// SECURITY: XSS, валидация, анти-фрод (клиент)
// Полная защита записи — только Firebase Rules
// ============================================

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeText(str, maxLen) {
  let s = String(str == null ? "" : str).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  s = s.trim();
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function isSafeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url, location.origin);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch (e) {
    return false;
  }
}

function safeImgUrl(url, fallback) {
  const fb = fallback || "https://via.placeholder.com/120?text=?";
  if (!url) return fb;
  if (String(url).includes("javascript:")) return fb;
  if (!isSafeUrl(url) && !String(url).startsWith("data:image/")) return fb;
  return url;
}

// Антиспам ставок
const _betRate = { count: 0, window: 0 };
function canPlaceBetNow() {
  const now = Date.now();
  if (now - _betRate.ts > 60000) { _betRate.count = 0; _betRate.ts = now; }
  if (_betRate.count >= 15) return false;
  _betRate.count++;
  return true;
}

function assertAdminOrThrow(user) {
  if (typeof isAdminUser === "function" && isAdminUser(user)) return true;
  throw new Error("Недостаточно прав (только админ)");
}

async function securityLog(action, detail) {
  try {
    if (!auth.currentUser) return;
    await db.ref("securityLog").push({
      action: String(action).slice(0, 80),
      detail: String(detail || "").slice(0, 300),
      uid: auth.currentUser.uid,
      email: auth.currentUser.email || "",
      at: new Date().toISOString()
    });
  } catch (e) { /* ignore */ }
}

window.escapeHtml = escapeHtml;
window.sanitizeText = sanitizeText;
window.safeImgUrl = safeImgUrl;
window.canPlaceBetNow = canPlaceBetNow;
window.assertAdminOrThrow = assertAdminOrThrow;
window.securityLog = securityLog;
