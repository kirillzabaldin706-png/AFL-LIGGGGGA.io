// ============================================
// Админ-помощник: команды для статистики и фото
// ============================================

(function () {
  let pendingPhotoFile = null;
  let pendingPhotoUrl = null;

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
    let t = list.find(x => (x.name || "").toLowerCase() === q);
    if (t) return t;
    t = list.find(x => (x.name || "").toLowerCase().includes(q));
    return t || null;
  }

  function findPlayer(name) {
    const q = (name || "").toLowerCase().trim();
    if (!q) return null;
    const list = (window.cache && cache.players) || [];
    let p = list.find(x => (x.name || "").toLowerCase() === q);
    if (p) return p;
    p = list.find(x => (x.name || "").toLowerCase().includes(q));
    return p || null;
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
        "Команды:\n" +
        "• результат КомандаА КомандаБ 2:1\n" +
        "• пенки 5:4  (к последнему матчу или укажите команды)\n" +
        "• пенки КомандаА КомандаБ 4:3\n" +
        "• гол Фамилия  или  гол Фамилия +2\n" +
        "• пас Фамилия  /  ассист Фамилия\n" +
        "• фото игроку Фамилия  (сначала выберите файл 📷)\n" +
        "• матч КомандаА - КомандаБ\n" +
        "• ссылка фото https://... игроку Фамилия",
        "bot"
      );
      return;
    }

    // ссылка фото URL игроку Name
    let m = text.match(/^(?:ссылка\s+)?фото\s+(https?:\/\/\S+)\s+игроку\s+(.+)$/i);
    if (m) {
      const url = m[1];
      const pl = findPlayer(m[2]);
      if (!pl) return addMsg("Игрок не найден: " + m[2], "bot");
      requireAdminLive();
      await db.ref("players/" + pl.id).update({ photo: url });
      pl.photo = url;
      addMsg("Фото обновлено для «" + pl.name + "».", "bot");
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    // фото игроку Name (file)
    m = text.match(/^фото\s+игроку\s+(.+)$/i);
    if (m) {
      const pl = findPlayer(m[1]);
      if (!pl) return addMsg("Игрок не найден: " + m[1], "bot");
      let url = pendingPhotoUrl;
      if (!url && pendingPhotoFile && typeof uploadToImgbb === "function") {
        addMsg("Загружаю фото…", "bot");
        url = await uploadToImgbb(pendingPhotoFile);
      }
      if (!url) return addMsg("Сначала выберите фото кнопкой 📷 или укажите ссылку.", "bot");
      requireAdminLive();
      await db.ref("players/" + pl.id).update({ photo: url });
      pl.photo = url;
      pendingPhotoFile = null;
      pendingPhotoUrl = null;
      const nameEl = document.getElementById("assistantPhotoName");
      if (nameEl) nameEl.textContent = "";
      addMsg("Готово: фото поставлено игроку «" + pl.name + "».", "bot");
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    // гол / пас
    m = text.match(/^(гол|пас|ассист)\s+(.+?)(?:\s+\+(\d+))?$/i);
    if (m) {
      const kind = m[1].toLowerCase();
      const pl = findPlayer(m[2]);
      if (!pl) return addMsg("Игрок не найден: " + m[2], "bot");
      const delta = m[3] ? Number(m[3]) : 1;
      const field = kind === "гол" ? "goals" : "assists";
      const next = await setPlayerStat(pl, field, delta);
      addMsg((kind === "гол" ? "Голы" : "Ассисты") + " «" + pl.name + "»: " + next, "bot");
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    // пенки A B 4:3  or пенки 4:3
    m = text.match(/^пенк[иа]?\s+(.+)$/i);
    if (m) {
      const rest = m[1].trim();
      const scoreM = rest.match(/(\d+)\s*[:\-]\s*(\d+)\s*$/);
      if (!scoreM) return addMsg("Формат: пенки 4:3 или пенки КомандаА КомандаБ 4:3", "bot");
      const hp = Number(scoreM[1]);
      const ap = Number(scoreM[2]);
      const left = rest.slice(0, scoreM.index).trim();
      let match = null;
      if (left) {
        // try two team names
        const parts = left.split(/\s+/);
        // greedy: find two teams
        const teams = (window.cache && cache.teams) || [];
        for (let i = 1; i < parts.length; i++) {
          const n1 = parts.slice(0, i).join(" ");
          const n2 = parts.slice(i).join(" ");
          const t1 = findTeam(n1);
          const t2 = findTeam(n2);
          if (t1 && t2) {
            match = findMatchByTeams(t1, t2);
            break;
          }
        }
      }
      if (!match) match = latestMatch();
      if (!match) return addMsg("Матч не найден.", "bot");
      requireAdminLive();
      // orient pens to home/away of match
      await db.ref("matches/" + match.id).update({
        homePenalties: hp,
        awayPenalties: ap
      });
      match.homePenalties = hp;
      match.awayPenalties = ap;
      const th = ((window.cache && cache.teams) || []).find(x => x.id === match.homeId);
      const ta = ((window.cache && cache.teams) || []).find(x => x.id === match.awayId);
      addMsg(
        "Пенальти сохранены: " + (th?.name || "?") + " " + hp + ":" + ap + " " + (ta?.name || "?"),
        "bot"
      );
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    // результат TeamA TeamB 2:1
    m = text.match(/^результат\s+(.+)$/i);
    if (m) {
      const rest = m[1].trim();
      const scoreM = rest.match(/(\d+)\s*[:\-]\s*(\d+)\s*$/);
      if (!scoreM) return addMsg("Формат: результат КомандаА КомандаБ 2:1", "bot");
      const hs = Number(scoreM[1]);
      const as = Number(scoreM[2]);
      const left = rest.slice(0, scoreM.index).trim();
      const parts = left.split(/\s+/);
      let t1 = null, t2 = null;
      for (let i = 1; i < parts.length; i++) {
        const a = findTeam(parts.slice(0, i).join(" "));
        const b = findTeam(parts.slice(i).join(" "));
        if (a && b) { t1 = a; t2 = b; break; }
      }
      if (!t1 || !t2) return addMsg("Не нашёл обе команды. Проверьте названия.", "bot");
      let match = findMatchByTeams(t1, t2);
      requireAdminLive();
      if (match) {
        const homeIsT1 = match.homeId === t1.id;
        await db.ref("matches/" + match.id).update({
          homeScore: homeIsT1 ? hs : as,
          awayScore: homeIsT1 ? as : hs,
          status: "finished"
        });
        addMsg("Обновлён матч: " + t1.name + " " + hs + ":" + as + " " + t2.name, "bot");
      } else {
        const ref = await db.ref("matches").push({
          homeId: t1.id,
          awayId: t2.id,
          homeScore: hs,
          awayScore: as,
          status: "finished",
          date: new Date().toISOString().slice(0, 16),
          stage: "regular"
        });
        addMsg("Создан и завершён матч: " + t1.name + " " + hs + ":" + as + " " + t2.name, "bot");
      }
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    // матч A - B
    m = text.match(/^матч\s+(.+?)\s*[-–—]\s*(.+)$/i);
    if (m) {
      const t1 = findTeam(m[1]);
      const t2 = findTeam(m[2].replace(/\s+\d{1,2}:\d{2}.*$/, "").trim());
      if (!t1 || !t2) return addMsg("Команды не найдены. Пример: матч Шторм - Инфинити", "bot");
      requireAdminLive();
      await db.ref("matches").push({
        homeId: t1.id,
        awayId: t2.id,
        homeScore: 0,
        awayScore: 0,
        status: "scheduled",
        date: new Date().toISOString().slice(0, 16),
        stage: "regular"
      });
      addMsg("Матч создан: " + t1.name + " — " + t2.name + " (скоро)", "bot");
      if (typeof loadAdminData === "function") await loadAdminData();
      return;
    }

    addMsg("Не понял команду. Напишите «помощь» для списка.", "bot");
  }

  function initAssistant() {
    const send = document.getElementById("assistantSend");
    const input = inputEl();
    const file = document.getElementById("assistantPhotoFile");
    if (!send || !input) return;

    if (!chatEl()?.dataset.welcomed) {
      addMsg("Привет! Я помогу заполнить статистику и поставить фото. Напишите «помощь».", "bot");
      if (chatEl()) chatEl().dataset.welcomed = "1";
    }

    const run = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      addMsg(text, "user");
      try {
        await handleCommand(text);
      } catch (err) {
        addMsg("Ошибка: " + (err.message || err), "bot");
      }
    };

    send.addEventListener("click", run);
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); run(); }
    });

    file?.addEventListener("change", () => {
      const f = file.files?.[0];
      pendingPhotoFile = f || null;
      pendingPhotoUrl = null;
      const nameEl = document.getElementById("assistantPhotoName");
      if (nameEl) nameEl.textContent = f ? f.name : "";
      if (f) addMsg("Фото выбрано: " + f.name + ". Напишите: фото игроку Фамилия", "bot");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAssistant);
  } else {
    initAssistant();
  }
  // re-init when switching to panel (nav)
  document.querySelectorAll(".admin-nav button").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.panel === "assistant") setTimeout(initAssistant, 50);
    });
  });
})();
