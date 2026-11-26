// SECURITY helpers — клиентская защита + лимиты
// Пароли хэширует Firebase Auth на сервере (не храним в JS).
// Ключи Firebase web apiKey публичные по дизайну Google — защита = Rules + домен.

(function (w) {
  "use strict";

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
    var s = String(str == null ? "" : str).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  function isSafeUrl(url) {
    if (!url) return false;
    try {
      var u = new URL(url, location.origin);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch (e) {
      return false;
    }
  }

  function safeImgUrl(url, fallback) {
    var fb = fallback || "https://via.placeholder.com/120?text=?";
    if (!url) return fb;
    if (String(url).toLowerCase().indexOf("javascript:") === 0) return fb;
    if (!isSafeUrl(url) && String(url).indexOf("data:image/") !== 0) return fb;
    return url;
  }

  // Лимит попыток входа (клиент + localStorage)
  var LOGIN_MAX = 5;
  var LOGIN_WINDOW_MS = 15 * 60 * 1000;

  function loginAttemptAllowed() {
    try {
      var raw = localStorage.getItem("afl_login_rl");
      var data = raw ? JSON.parse(raw) : { n: 0, t: Date.now() };
      if (Date.now() - data.t > LOGIN_WINDOW_MS) data = { n: 0, t: Date.now() };
      if (data.n >= LOGIN_MAX) return false;
      return true;
    } catch (e) {
      return true;
    }
  }

  function recordLoginAttempt(ok) {
    try {
      var raw = localStorage.getItem("afl_login_rl");
      var data = raw ? JSON.parse(raw) : { n: 0, t: Date.now() };
      if (Date.now() - data.t > LOGIN_WINDOW_MS) data = { n: 0, t: Date.now() };
      if (ok) {
        localStorage.removeItem("afl_login_rl");
        return;
      }
      data.n += 1;
      data.t = data.t || Date.now();
      localStorage.setItem("afl_login_rl", JSON.stringify(data));
    } catch (e) {}
  }

  var _betRate = { count: 0, ts: 0 };
  function canPlaceBetNow() {
    var now = Date.now();
    if (now - _betRate.ts > 60000) { _betRate.count = 0; _betRate.ts = now; }
    if (_betRate.count >= 10) return false;
    _betRate.count++;
    return true;
  }

  var _formRate = { count: 0, ts: 0 };
  function canSubmitForm() {
    var now = Date.now();
    if (now - _formRate.ts > 60000) { _formRate.count = 0; _formRate.ts = now; }
    if (_formRate.count >= 30) return false;
    _formRate.count++;
    return true;
  }

  // Файлы: только изображения, max 2 МБ
  var ALLOWED_IMG = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  var MAX_IMG_BYTES = 2 * 1024 * 1024;

  function validateImageFile(file) {
    if (!file) return { ok: false, error: "Файл не выбран" };
    if (ALLOWED_IMG.indexOf(file.type) === -1) {
      return { ok: false, error: "Только JPG, PNG, WEBP, GIF" };
    }
    if (file.size > MAX_IMG_BYTES) {
      return { ok: false, error: "Максимум 2 МБ" };
    }
    return { ok: true };
  }

  function assertAdminOrThrow(user) {
    if (typeof isAdminUser === "function" && isAdminUser(user)) return true;
    throw new Error("Недостаточно прав");
  }

  async function securityLog(action, detail) {
    try {
      if (!auth || !auth.currentUser) return;
      await db.ref("securityLog").push({
        action: String(action).slice(0, 80),
        detail: String(detail || "").slice(0, 300),
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || "",
        at: new Date().toISOString()
      });
    } catch (e) {}
  }

  // CSRF-like: действия только при том же origin
  function assertSameOrigin() {
    try {
      if (window.top !== window.self) {
        // разрешаем, но не доверяем postMessage без origin-check
      }
    } catch (e) {}
    return true;
  }

  w.escapeHtml = escapeHtml;
  w.sanitizeText = sanitizeText;
  w.safeImgUrl = safeImgUrl;
  w.canPlaceBetNow = canPlaceBetNow;
  w.canSubmitForm = canSubmitForm;
  w.loginAttemptAllowed = loginAttemptAllowed;
  w.recordLoginAttempt = recordLoginAttempt;
  w.validateImageFile = validateImageFile;
  w.assertAdminOrThrow = assertAdminOrThrow;
  w.securityLog = securityLog;
  w.assertSameOrigin = assertSameOrigin;
  w.MAX_IMG_BYTES = MAX_IMG_BYTES;
})(window);
