// Плавающий помощник АФЛ (админка)
(function () {
  let pendingPhotoFile = null;
  let pendingPhotoUrl = null;
  let openedOnce = false;

  const SUGGESTIONS = [
    { label: "Помощь", text: "помощь" },
    { label: "Результат матча", text: "результат " },
    { label: "Пенальти", text: "пенки " },
    { label: "Гол игроку", text: "гол " },
    { label: "Фото игроку", text: "фото игроку " },
    { label: "Новый матч", text: "матч " },
    { label: "Новость", text: "новость " }
  ];

  function chatEl() { return document.getElementById("assistantChat"); }
  function inputEl() { return document.getElementById("assistantInput"); }

  function addMsg(text, who) {
    const box = chatEl();
    if (!box) return;
    const div = document.createElement("div");
    div.className = "assistant-msg " + (who === "user" ? "user" : "bot");
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const pre = document.createElement("pre");
    pre.textContent = text;
    bubble.appendChild(pre);
    div.appendChild(bubble);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function findTeam(name) {
    const q = (name || "").toLowerCase().trim();
    if (!q) return null;
    const list = (window.cache && cache.teams) || [];
    return list.find(x => (x.name || "").toLowerCase() === q) ||
      list.find(x => (x.name || "").toLowerCase().includes(q)) || null;
  }

  function findPlayer(name) {
    const q = (name || "").toLowerCase().trim();
    if (!q) return null;
    const list = (window.cache && cache.players) || [];
    return list.find(x => (x.name || "").toLowerCase() === q) ||
      list.find(x => (x.name || "").toLowerCase().includes(q)) || null;
  }

  function findMatchByTeams(a, b) {
    const list = (window.cache && cache.matches) || [];
    return list.find(m =>
      (m.homeId === a.id && m.awayId === b.id) ||
      (m.homeId === b.id && m.awayId === a.id)
    ) || null;
  }

  function latestMatch() {
    const list = [...((window.cache && cache.matches) || [])];
    list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return list[0] || null;
  }

  function splitTwoTeams(left) {
    const parts = left.trim().split(/\s+/);
    for (let i = 1; i < parts.length; i++) {
      const t1 = findTeam(parts.slice(0, i).join(" "));
      const t2 = findTeam(parts.slice(i).join(" "));
      if (t1 && t2) return [t1, t2];
    }
    return [null, null];
  }

  async function setPlayerStat(player, field, delta) {
    requireAdminLive();
    const cur = Number(player[field]) || 0;
    const next = Math.max(0, cur + delta);
    await db.ref("players/" + player.id).update({ [field]: next });
    player[field] = next;
    return next;
  }

  async function handleCommand(raw) {
    const text = (raw || "").trim();
    if (!text) return;
    const low = text.toLowerCase();

    if (low === "помощь" || low === "help" || low === "?") {
      addMsg(
        "Я могу:\n" +
        "• результат КомандаА КомандаБ 2:1\n" +
        "• пенки 4:3  или  пенки А Б 5:4\n" +
        "• гол Фамилия  /  гол Фамилия +2\n" +
        "• пас Фамилия\n" +
        "• фото игроку Фамилия (файл 📷)\n" +
        "• ссылка фото https://… игроку Фамилия\n" +
        "• матч КомандаА - КомандаБ\n" +
        "• новость Заголовок | Текст новости\n" +
        "• согласие Фамилия да/нет",
        "bot"
      );
      return;
    }

    let m = text.match(/^(?:ссылка\s+)?фото\s+(https?:\/\/\S+)\s+игроку\s+(.+)$/i);
    if (m) {
      const pl = findPlayer(m[2]);
      if (!pl) return addMsg("Игрок не найден: " + m[2], "bot");
      requireAdminLive();
      await db.ref("players/" + pl.id).update({ photo: m[1] });
      pl.photo = m[1];
      addMsg("Фото обновлено: «" + pl.name + "»", "bot");
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    m = text.match(/^фото\s+игроку\s+(.+)$/i);
    if (m) {
      const pl = findPlayer(m[1]);
      if (!pl) return addMsg("Игрок не найден: " + m[1], "bot");
      let url = pendingPhotoUrl;
      if (!url && pendingPhotoFile && typeof uploadToImgbb === "function") {
        addMsg("Загружаю фото…", "bot");
        url = await uploadToImgbb(pendingPhotoFile);
      }
      if (!url) return addMsg("Сначала нажмите 📷 и выберите файл.", "bot");
      requireAdminLive();
      await db.ref("players/" + pl.id).update({ photo: url });
      pl.photo = url;
      pendingPhotoFile = null;
      pendingPhotoUrl = null;
      const nameEl = document.getElementById("assistantPhotoName");
      if (nameEl) nameEl.textContent = "";
      addMsg("Готово: фото у «" + pl.name + "»", "bot");
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    m = text.match(/^(гол|пас|ассист)\s+(.+?)(?:\s+\+(\d+))?$/i);
    if (m) {
      const pl = findPlayer(m[2]);
      if (!pl) return addMsg("Игрок не найден: " + m[2], "bot");
      const delta = m[3] ? Number(m[3]) : 1;
      const field = m[1].toLowerCase() === "гол" ? "goals" : "assists";
      const next = await setPlayerStat(pl, field, delta);
      addMsg((field === "goals" ? "Голы" : "Ассисты") + " «" + pl.name + "»: " + next, "bot");
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    m = text.match(/^согласие\s+(.+?)\s+(да|нет)$/i);
    if (m) {
      const pl = findPlayer(m[1]);
      if (!pl) return addMsg("Игрок не найден", "bot");
      const consent = m[2].toLowerCase() === "да";
      requireAdminLive();
      await db.ref("players/" + pl.id).update({ consent });
      pl.consent = consent;
      addMsg("Согласие «" + pl.name + "»: " + (consent ? "да" : "нет"), "bot");
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    m = text.match(/^пенк[иа]?\s+(.+)$/i);
    if (m) {
      const rest = m[1].trim();
      const scoreM = rest.match(/(\d+)\s*[:\-]\s*(\d+)\s*$/);
      if (!scoreM) return addMsg("Формат: пенки 4:3", "bot");
      const hp = Number(scoreM[1]), ap = Number(scoreM[2]);
      const left = rest.slice(0, scoreM.index).trim();
      let match = null;
      if (left) {
        const [t1, t2] = splitTwoTeams(left);
        if (t1 && t2) match = findMatchByTeams(t1, t2);
      }
      if (!match) match = latestMatch();
      if (!match) return addMsg("Матч не найден", "bot");
      requireAdminLive();
      await db.ref("matches/" + match.id).update({ homePenalties: hp, awayPenalties: ap });
      addMsg("Пенальти: " + hp + ":" + ap, "bot");
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    m = text.match(/^результат\s+(.+)$/i);
    if (m) {
      const rest = m[1].trim();
      const scoreM = rest.match(/(\d+)\s*[:\-]\s*(\d+)\s*$/);
      if (!scoreM) return addMsg("Формат: результат КомандаА КомандаБ 2:1", "bot");
      const hs = Number(scoreM[1]), as_ = Number(scoreM[2]);
      const left = rest.slice(0, scoreM.index).trim();
      const [t1, t2] = splitTwoTeams(left);
      if (!t1 || !t2) return addMsg("Не нашёл команды", "bot");
      requireAdminLive();
      let match = findMatchByTeams(t1, t2);
      if (match) {
        const homeIsT1 = match.homeId === t1.id;
        await db.ref("matches/" + match.id).update({
          homeScore: homeIsT1 ? hs : as_,
          awayScore: homeIsT1 ? as_ : hs,
          status: "finished"
        });
        addMsg("Обновлено: " + t1.name + " " + hs + ":" + as_ + " " + t2.name, "bot");
      } else {
        await db.ref("matches").push({
          homeId: t1.id, awayId: t2.id,
          homeScore: hs, awayScore: as_,
          status: "finished",
          date: new Date().toISOString().slice(0, 16),
          stage: "regular"
        });
        addMsg("Матч создан и завершён: " + t1.name + " " + hs + ":" + as_ + " " + t2.name, "bot");
      }
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    m = text.match(/^матч\s+(.+?)\s*[-–—]\s*(.+)$/i);
    if (m) {
      const t1 = findTeam(m[1]);
      const t2 = findTeam(m[2].trim());
      if (!t1 || !t2) return addMsg("Команды не найдены", "bot");
      requireAdminLive();
      await db.ref("matches").push({
        homeId: t1.id, awayId: t2.id,
        homeScore: 0, awayScore: 0,
        status: "scheduled",
        date: new Date().toISOString().slice(0, 16),
        stage: "regular"
      });
      addMsg("Матч создан: " + t1.name + " — " + t2.name, "bot");
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    m = text.match(/^новость\s+(.+?)\s*\|\s*(.+)$/is);
    if (m) {
      requireAdminLive();
      await db.ref("news").push({
        title: m[1].trim().slice(0, 120),
        text: m[2].trim().slice(0, 2000),
        date: new Date().toISOString()
      });
      addMsg("Новость добавлена: «" + m[1].trim() + "»", "bot");
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    addMsg("Не понял. Нажмите «Помощь» или выберите подсказку сверху.", "bot");
  }

  function fillSuggestions() {
    const wrap = document.getElementById("aflBotSuggestions");
    if (!wrap || wrap.dataset.ready) return;
    wrap.dataset.ready = "1";
    SUGGESTIONS.forEach(s => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "afl-bot-chip";
      b.textContent = s.label;
      b.addEventListener("click", () => {
        const inp = inputEl();
        if (!inp) return;
        if (s.text === "помощь") {
          inp.value = s.text;
          document.getElementById("assistantSend")?.click();
        } else {
          inp.value = s.text;
          inp.focus();
        }
      });
      wrap.appendChild(b);
    });
  }

  function openBot() {
    const panel = document.getElementById("aflBotPanel");
    if (!panel) return;
    panel.hidden = false;
    fillSuggestions();
    if (!openedOnce) {
      openedOnce = true;
      if (chatEl() && !chatEl().dataset.welcomed) {
        addMsg("Привет! Я всегда здесь справа внизу.\nВыберите подсказку или напишите команду.\nНапример: результат Шторм Инфинити 2:1", "bot");
        chatEl().dataset.welcomed = "1";
      }
    }
    setTimeout(() => inputEl()?.focus(), 100);
  }

  function closeBot() {
    const panel = document.getElementById("aflBotPanel");
    if (panel) panel.hidden = true;
  }

  function init() {
    const fab = document.getElementById("aflBotFab");
    const close = document.getElementById("aflBotClose");
    const send = document.getElementById("assistantSend");
    const input = inputEl();
    const file = document.getElementById("assistantPhotoFile");
    if (!fab) return;

    fab.onclick = () => {
      const panel = document.getElementById("aflBotPanel");
      if (panel && !panel.hidden) closeBot();
      else openBot();
    };
    close?.addEventListener("click", closeBot);

    const run = async () => {
      const text = input?.value.trim();
      if (!text) return;
      input.value = "";
      addMsg(text, "user");
      try { await handleCommand(text); }
      catch (err) { addMsg("Ошибка: " + (err.message || err), "bot"); }
    };
    send?.addEventListener("click", run);
    input?.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); run(); }
    });
    file?.addEventListener("change", () => {
      const f = file.files?.[0];
      pendingPhotoFile = f || null;
      const nameEl = document.getElementById("assistantPhotoName");
      if (nameEl) nameEl.textContent = f ? f.name : "";
      if (f) {
        openBot();
        addMsg("Фото выбрано. Напишите: фото игроку Фамилия", "bot");
      }
    });

    // лёгкое привлечение внимания через 2.5 сек
    setTimeout(() => {
      if (openedOnce) return;
      fab?.classList.add("afl-bot-fab-hint");
    }, 2500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
