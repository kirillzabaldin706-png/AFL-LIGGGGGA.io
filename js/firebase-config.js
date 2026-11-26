// Конфиг не хранится открытым текстом (защита от случайного просмотра файла).
// Это НЕ секрет на 100%: в Network/отладчике значения всё равно можно увидеть.
// Реальная защита: Firebase Rules + ограничение API key по домену в Google Cloud.
(function () {
  "use strict";
  function _d(h) {
    var out = "";
    for (var i = 0; i < h.length; i += 2) {
      out += String.fromCharCode(parseInt(h.substr(i, 2), 16) ^ 0x5A);
    }
    return out;
  }
  var _p = {
    k: "1b13203b09231e2d311d2f102f1d2c13380d3d383b3b1e183d280902150a6c2a292c3b200d3403",
    a: "3b3c367736333d3b743c33283f383b293f3b2a2a74393537",
    u: "322e2e2a296075753b3c367736333d3b773e3f3c3b2f362e77282e3e38743c33283f383b293f333574393537",
    p: "3b3c367736333d3b",
    s: "3b3c367736333d3b743c33283f383b293f292e35283b3d3f743b2a2a",
    m: "636a6a6962686e6f626b6d69",
    i: "6b60636a6a6962686e6f626b6d69602d3f3860636a6b396c6f6d693b6e6a6a396b6c6869396e6f6f6e",
    g: "1d7711101f1d11110a6c1110",
    b: "6d686b6b386e6c6338686b6b3c383f623f3e3e3c6d68626f6a6e683f386b6d3e",
    e1: "1b1c167716131d1b1a373b333674282f",
    e2: "3b3c367736333d3b1a373b333674282f"
  };
  var firebaseConfig = {
    apiKey: _d(_p.k),
    authDomain: _d(_p.a),
    databaseURL: _d(_p.u),
    projectId: _d(_p.p),
    storageBucket: _d(_p.s),
    messagingSenderId: _d(_p.m),
    appId: _d(_p.i),
    measurementId: _d(_p.g)
  };
  firebase.initializeApp(firebaseConfig);
  window.db = firebase.database();
  window.auth = firebase.auth();
  // совместимость со старым кодом
  var db = window.db;
  var auth = window.auth;

  var ADMIN_EMAILS = [_d(_p.e1), _d(_p.e2)];
  window.ADMIN_EMAILS = ADMIN_EMAILS;

  function isAdminUser(user) {
    if (!user || !user.email) return false;
    var email = String(user.email).trim().toLowerCase();
    return ADMIN_EMAILS.map(function (e) { return e.toLowerCase(); }).indexOf(email) !== -1;
  }
  window.isAdminUser = isAdminUser;

  var IMGBB_API_KEY = _d(_p.b);
  window.IMGBB_API_KEY = IMGBB_API_KEY;

  async function uploadToImgbb(file) {
    if (!file) return null;
    if (typeof validateImageFile === "function") {
      var check = validateImageFile(file);
      if (!check.ok) {
        if (typeof showToast === "function") showToast(check.error || "Файл отклонён", true);
        return null;
      }
    }
    var formData = new FormData();
    formData.append("image", file);
    try {
      var res = await fetch("https://api.imgbb.com/1/upload?key=" + IMGBB_API_KEY, {
        method: "POST",
        body: formData
      });
      var data = await res.json();
      if (data.success) return data.data.url;
      throw new Error((data.error && data.error.message) || "Upload failed");
    } catch (err) {
      console.error("ImgBB upload error:", err);
      if (typeof showToast === "function") showToast("Ошибка загрузки изображения", true);
      return null;
    }
  }
  window.uploadToImgbb = uploadToImgbb;

  function showToast(msg, isError) {
    isError = !!isError;
    var toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    setTimeout(function () { toast.classList.remove("show"); }, 3000);
  }
  window.showToast = showToast;

  function getPlayerPhoto(player) {
    var placeholder = "https://via.placeholder.com/120x120?text=?";
    if (!player) return { url: placeholder, blurred: true };
    var url = player.photo || placeholder;
    var blurred = !player.consent;
    return { url: url, blurred: blurred };
  }
  window.getPlayerPhoto = getPlayerPhoto;
})();
