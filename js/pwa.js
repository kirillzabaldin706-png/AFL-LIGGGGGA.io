/* Регистрация PWA + кнопка «Установить приложение» */
(function () {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("SW register failed", err);
    });
  });

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallUI(true);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    showInstallUI(false);
    if (typeof showToast === "function") showToast("Приложение АФЛ установлено");
  });

  function showInstallUI(show) {
    let btn = document.getElementById("pwaInstallBtn");
    if (!btn && show) {
      btn = document.createElement("button");
      btn.id = "pwaInstallBtn";
      btn.type = "button";
      btn.className = "pwa-install-btn";
      btn.innerHTML = "📲 Установить приложение";
      btn.addEventListener("click", async () => {
        if (!deferredPrompt) {
          alert(
            "Чтобы установить АФЛ:\n\n" +
              "Android / Chrome: меню ⋮ → «Установить приложение»\n" +
              "iPhone Safari: Поделиться → «На экран Домой»\n" +
              "Компьютер Chrome/Edge: иконка установки в адресной строке"
          );
          return;
        }
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        showInstallUI(false);
      });
      document.body.appendChild(btn);
    }
    if (btn) btn.style.display = show ? "flex" : "none";
  }

  // На iOS нет beforeinstallprompt — показываем подсказку реже
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isIos && !isStandalone) {
    setTimeout(() => {
      if (document.getElementById("pwaInstallBtn")) return;
      const btn = document.createElement("button");
      btn.id = "pwaInstallBtn";
      btn.type = "button";
      btn.className = "pwa-install-btn";
      btn.innerHTML = "📲 На экран Домой";
      btn.addEventListener("click", () => {
        alert(
          "Установка на iPhone / iPad:\n\n" +
            "1. Откройте сайт в Safari\n" +
            "2. Нажмите кнопку «Поделиться» ⎋\n" +
            "3. Выберите «На экран «Домой»»\n" +
            "4. Нажмите «Добавить»\n\n" +
            "Иконка АФЛ появится на рабочем столе."
        );
      });
      document.body.appendChild(btn);
    }, 2500);
  }
})();
