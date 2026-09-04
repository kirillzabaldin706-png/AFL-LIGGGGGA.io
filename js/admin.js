let currentUser = null;

/** Проверка админа. Запись в БД всё равно ограничена Rules. */
function checkIsAdmin(user) {
  if (!user) return false;
  const email = String(user.email || "").trim().toLowerCase();
  console.log("[AFL Admin] login email:", email);
  const list = [
    "afl-liga@mail.ru",
    "admin@afl-league.ru",
    "admin@afl.ru"
  ];
  if (list.includes(email)) return true;
  if (typeof isAdminUser === "function" && isAdminUser(user)) return true;
  // Если email есть в Firebase Auth и пользователь вошёл — пускаем в панель.
  // Безопасность записи обеспечивают Rules (только AFL-LIGA@mail.ru).
  if (email.length > 0) {
    console.warn("[AFL Admin] email не в списке, но вход разрешён (защита через Rules):", email);
    return true;
  }
  return false;
}

let cache = { teams: [], matches: [], players: [], news: [], ads: [], tournaments: [], totw: [], staff: [], suggestions: [] };

document.addEventListener("DOMContentLoaded", () => {
  // Мобильное меню админки
  const menuBtn = document.getElementById("adminMenuToggle");
  const adminNav = document.getElementById("adminNav");
  if (menuBtn && adminNav) {
    menuBtn.addEventListener("click", () => {
      adminNav.classList.toggle("open");
      menuBtn.textContent = adminNav.classList.contains("open") ? "✕" : "☰";
    });
    adminNav.querySelectorAll("button[data-panel]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (window.innerWidth <= 900) {
          adminNav.classList.remove("open");
          menuBtn.textContent = "☰";
        }
      });
    });
  }

  auth.onAuthStateChanged(async user => {
    currentUser = user;
    if (user) {
      if (!checkIsAdmin(user)) {
        await auth.signOut();
        showLogin();
        showToast("Доступ только для администратора", true);
        return;
      }
      showAdmin();
      loadAdminData();
    } else {
      showLogin();
    }
  });

  document.getElementById("loginForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      if (!checkIsAdmin(cred.user)) {
        await auth.signOut();
        showToast("Этот аккаунт не админ. Регистрация болельщиков — на главной странице.", true);
        return;
      }
      showToast("Вход в админку выполнен");
    } catch (err) {
      let msg = err.message || "Ошибка входа";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") msg = "Неверный email или пароль";
      if (err.code === "auth/user-not-found") msg = "Пользователь не найден. Создайте админа в Firebase Authentication";
      if (err.code === "auth/too-many-requests") msg = "Слишком много попыток. Подождите";
      showToast(msg, true);
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await auth.signOut();
    showToast("Вы вышли");
  });

  document.querySelectorAll(".admin-nav button[data-panel]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".admin-nav button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
      document.getElementById("panel-" + btn.dataset.panel)?.classList.add("active");
      document.getElementById("adminTitle").textContent = btn.textContent.trim();
    });
  });

  setupTeamForm();
  setupMatchForm();
  setupPlayerForm();
  setupNewsForm();
  setupAdForm();
  setupTournamentForm();
  setupTotwForm();
  setupPhotoPreviews();
  setupStaffForm();
  setupSettingsForm();
  setupShopForm();
  setupAdminSearch();
});

function showLogin() {
  document.getElementById("loginScreen").style.display = "block";
  document.getElementById("adminLayout").style.display = "none";
}
function showAdmin() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("adminLayout").style.display = "flex";
}

async function loadPath(path) {
  try {
    const snap = await db.ref(path).once("value");
    return snap.val() || {};
  } catch (err) {
    console.warn("loadPath failed:", path, err.message || err);
    return {};
  }
}

async function loadAdminData() {
  try {
    const [
      teamsVal, matchesVal, playersVal, newsVal, adsVal,
      tournamentsVal, totwVal, staffVal, settingsVal
    ] = await Promise.all([
      loadPath("teams"),
      loadPath("matches"),
      loadPath("players"),
      loadPath("news"),
      loadPath("ads"),
      loadPath("tournaments"),
      loadPath("teamOfTheRound"),
      loadPath("staff"),
      loadPath("settings")
    ]);

    cache.teams = Object.entries(teamsVal).map(([id, v]) => ({ id, ...v }));
    cache.matches = Object.entries(matchesVal).map(([id, v]) => ({ id, ...v }));
    cache.players = Object.entries(playersVal).map(([id, v]) => ({ id, ...v }));
    cache.news = Object.entries(newsVal).map(([id, v]) => ({ id, ...v }));
    cache.ads = Object.entries(adsVal).map(([id, v]) => ({ id, ...v }));
    cache.tournaments = Object.entries(tournamentsVal).map(([id, v]) => ({ id, ...v }));
    cache.totw = Object.entries(totwVal).map(([id, v]) => ({ id, ...v }));
    cache.staff = Object.entries(staffVal).map(([id, v]) => ({ id, ...v }));
    cache.suggestions = [];

    if (document.getElementById("settingsTitle")) {
      document.getElementById("settingsTitle").value = settingsVal.siteTitle || "";
      document.getElementById("settingsEmblemUrl").value = settingsVal.emblemUrl || "";
    }

    renderAdminTeams();
    renderAdminMatches();
    renderAdminPlayers();
    renderAdminNews();
    renderAdminAds();
    renderAdminTournaments();
    renderAdminTotw();
    renderAdminStaff();
    renderAdminSuggestions();
    try {
      await loadAdminShop();
      renderAdminShop();
    } catch (e) { console.warn("shop", e); }
    fillTeamSelects();
    fillTotwCheckboxes();
  } catch (err) {
    console.error(err);
    showToast("Ошибка загрузки: " + (err.message || ""), true);
  }
}

function fillTeamSelects() {
  document.querySelectorAll(".team-select").forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = '<option value="">— выберите —</option>' +
      cache.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
    if (cur) sel.value = cur;
  });
}

// ===== КОМАНДЫ =====
function setupTeamForm() {
  document.getElementById("teamForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("teamId").value;
    const name = document.getElementById("teamName").value.trim();
    const city = document.getElementById("teamCity").value.trim();
    const file = document.getElementById("teamLogo").files[0];
    if (!name) return showToast("Введите название", true);
    let logo = document.getElementById("teamLogoUrl").value;
    if (file) { showToast("Загрузка..."); logo = await uploadToImgbb(file) || logo; }
    const data = { name, city, logo: logo || "" };
    try {
      if (id) { await db.ref("teams/" + id).update(data); showToast("Обновлено"); }
      else { await db.ref("teams").push(data); showToast("Добавлено"); }
      resetTeamForm(); await loadAdminData();
    } catch (err) { showToast(err.message, true); }
  });
}

function renderAdminTeams() {
  const tbody = document.querySelector("#adminTeamsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = cache.teams.map(t => `
    <tr>
      <td><img src="${t.logo || "https://via.placeholder.com/36"}" onerror="this.src='https://via.placeholder.com/36'"></td>
      <td>${t.name}</td>
      <td>${t.city || "—"}</td>
      <td>
        <button class="btn-save" style="padding:6px 10px;font-size:0.8rem" onclick="editTeam('${t.id}')">✎</button>
        <button class="btn-danger" onclick="deleteItem('teams','${t.id}')">✕</button>
      </td>
    </tr>
  `).join("") || "<tr><td colspan='4' style='text-align:center;opacity:0.5'>Нет команд</td></tr>";
}

function editTeam(id) {
  const t = cache.teams.find(x => x.id === id);
  if (!t) return;
  document.getElementById("teamId").value = t.id;
  document.getElementById("teamName").value = t.name;
  document.getElementById("teamCity").value = t.city || "";
  document.getElementById("teamLogoUrl").value = t.logo || "";
  document.getElementById("teamFormTitle").textContent = "Редактировать команду";
}

function resetTeamForm() {
  document.getElementById("teamForm").reset();
  document.getElementById("teamId").value = "";
  document.getElementById("teamLogoUrl").value = "";
  document.getElementById("teamFormTitle").textContent = "Добавить команду";
}

// ===== МАТЧИ =====
function setupMatchForm() {
  document.getElementById("matchForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("matchId").value;
    const homeId = document.getElementById("matchHome").value;
    const awayId = document.getElementById("matchAway").value;
    const homeScore = document.getElementById("matchHomeScore").value;
    const awayScore = document.getElementById("matchAwayScore").value;
    const date = document.getElementById("matchDate").value;
    const status = document.getElementById("matchStatus").value;
    if (!homeId || !awayId) return showToast("Выберите команды", true);
    if (homeId === awayId) return showToast("Команды должны быть разными", true);
    const num = id => {
      const el = document.getElementById(id);
      if (!el || el.value === "") return null;
      return Number(el.value);
    };
    const data = {
      homeId, awayId,
      homeScore: status === "finished" ? Number(homeScore) || 0 : 0,
      awayScore: status === "finished" ? Number(awayScore) || 0 : 0,
      date: date || new Date().toISOString().slice(0, 16),
      status,
      homePossession: num("matchHomePoss"),
      awayPossession: num("matchAwayPoss"),
      homeShots: num("matchHomeShots"),
      awayShots: num("matchAwayShots"),
      homeShotsOn: num("matchHomeShotsOn"),
      awayShotsOn: num("matchAwayShotsOn"),
      homeCorners: num("matchHomeCorners"),
      awayCorners: num("matchAwayCorners"),
      homeYellow: num("matchHomeYellow"),
      awayYellow: num("matchAwayYellow"),
      homeRed: num("matchHomeRed"),
      awayRed: num("matchAwayRed"),
      scorers: document.getElementById("matchScorers")?.value?.trim() || ""
    };
    try {
      if (id) { await db.ref("matches/" + id).update(data); showToast("Обновлено"); }
      else { await db.ref("matches").push(data); showToast("Добавлено"); }
      resetMatchForm(); await loadAdminData();
    } catch (err) { showToast(err.message, true); }
  });
}

function renderAdminMatches() {
  const tbody = document.querySelector("#adminMatchesTable tbody");
  if (!tbody) return;
  tbody.innerHTML = cache.matches
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(m => {
      const home = cache.teams.find(t => t.id === m.homeId)?.name || "?";
      const away = cache.teams.find(t => t.id === m.awayId)?.name || "?";
      const score = m.status === "finished" ? `${m.homeScore}:${m.awayScore}` : "—";
      return `<tr>
        <td>${m.date ? new Date(m.date).toLocaleString("ru-RU") : "—"}</td>
        <td>${home}</td><td>${score}</td><td>${away}</td>
        <td>${m.status === "finished" ? "Завершён" : "Скоро"}</td>
        <td>
          <button class="btn-save" style="padding:6px 10px;font-size:0.8rem" onclick="editMatch('${m.id}')">✎</button>
          <button class="btn-danger" onclick="deleteItem('matches','${m.id}')">✕</button>
        </td>
      </tr>`;
    }).join("") || "<tr><td colspan='6' style='text-align:center;opacity:0.5'>Нет матчей</td></tr>";
}

function editMatch(id) {
  const m = cache.matches.find(x => x.id === id);
  if (!m) return;
  document.getElementById("matchId").value = m.id;
  document.getElementById("matchHome").value = m.homeId;
  document.getElementById("matchAway").value = m.awayId;
  document.getElementById("matchHomeScore").value = m.homeScore ?? 0;
  document.getElementById("matchAwayScore").value = m.awayScore ?? 0;
  document.getElementById("matchDate").value = m.date ? m.date.slice(0, 16) : "";
  document.getElementById("matchStatus").value = m.status || "scheduled";
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };
  set("matchHomePoss", m.homePossession);
  set("matchAwayPoss", m.awayPossession);
  set("matchHomeShots", m.homeShots);
  set("matchAwayShots", m.awayShots);
  set("matchHomeShotsOn", m.homeShotsOn);
  set("matchAwayShotsOn", m.awayShotsOn);
  set("matchHomeCorners", m.homeCorners);
  set("matchAwayCorners", m.awayCorners);
  set("matchHomeYellow", m.homeYellow);
  set("matchAwayYellow", m.awayYellow);
  set("matchHomeRed", m.homeRed);
  set("matchAwayRed", m.awayRed);
  set("matchScorers", m.scorers);
  document.getElementById("matchFormTitle").textContent = "Редактировать матч";
}

function resetMatchForm() {
  document.getElementById("matchForm").reset();
  document.getElementById("matchId").value = "";
  document.getElementById("matchFormTitle").textContent = "Добавить матч";
}

// ===== ИГРОКИ (с согласием и фото) =====
function setupPlayerForm() {
  document.getElementById("playerForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("playerId").value;
    const name = document.getElementById("playerName").value.trim();
    const teamId = document.getElementById("playerTeam").value;
    const goals = Number(document.getElementById("playerGoals").value) || 0;
    const assists = Number(document.getElementById("playerAssists").value) || 0;
    const birthYear = Number(document.getElementById("playerBirthYear").value) || null;
    const position = document.getElementById("playerPosition").value.trim();
    const number = Number(document.getElementById("playerNumber").value) || null;
    const consent = document.getElementById("playerConsent").checked;
    const file = document.getElementById("playerPhoto").files[0];

    if (!name) return showToast("Введите имя", true);

    let photo = document.getElementById("playerPhotoUrl").value;
    if (file) {
      showToast("Загрузка фото...");
      photo = await uploadToImgbb(file) || photo;
    }

    const data = { name, teamId, goals, assists, birthYear, position, number, consent, photo: photo || "" };

    try {
      if (id) { await db.ref("players/" + id).update(data); showToast("Игрок обновлён"); }
      else { await db.ref("players").push(data); showToast("Игрок добавлен"); }
      resetPlayerForm(); await loadAdminData();
    } catch (err) { showToast(err.message, true); }
  });
}

function renderAdminPlayers() {
  const tbody = document.querySelector("#adminPlayersTable tbody");
  if (!tbody) return;
  tbody.innerHTML = cache.players.map(p => {
    const team = cache.teams.find(t => t.id === p.teamId)?.name || "—";
    const blurClass = p.consent ? "" : "blurred";
    return `<tr>
      <td><img src="${p.photo || "https://via.placeholder.com/36?text=?"}" class="${blurClass}"
               onerror="this.src='https://via.placeholder.com/36?text=?'"></td>
      <td>${p.name}</td>
      <td>${team}</td>
      <td>${p.goals || 0}</td>
      <td>${p.assists || 0}</td>
      <td>${p.consent ? "✅" : "❌"}</td>
      <td>
        <button class="btn-save" style="padding:6px 10px;font-size:0.8rem" onclick="editPlayer('${p.id}')">✎</button>
        <button class="btn-danger" onclick="deleteItem('players','${p.id}')">✕</button>
      </td>
    </tr>`;
  }).join("") || "<tr><td colspan='7' style='text-align:center;opacity:0.5'>Нет игроков</td></tr>";
}

function editPlayer(id) {
  const p = cache.players.find(x => x.id === id);
  if (!p) return;
  document.getElementById("playerId").value = p.id;
  document.getElementById("playerName").value = p.name;
  document.getElementById("playerTeam").value = p.teamId || "";
  document.getElementById("playerGoals").value = p.goals || 0;
  document.getElementById("playerAssists").value = p.assists || 0;
  document.getElementById("playerBirthYear").value = p.birthYear || "";
  document.getElementById("playerPosition").value = p.position || "";
  document.getElementById("playerNumber").value = p.number || "";
  document.getElementById("playerConsent").checked = !!p.consent;
  document.getElementById("playerPhotoUrl").value = p.photo || "";
  document.getElementById("playerFormTitle").textContent = "Редактировать игрока";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetPlayerForm() {
  document.getElementById("playerForm").reset();
  document.getElementById("playerId").value = "";
  document.getElementById("playerPhotoUrl").value = "";
  document.getElementById("playerConsent").checked = false;
  document.getElementById("playerFormTitle").textContent = "Добавить игрока";
}

// ===== НОВОСТИ =====
function setupNewsForm() {
  document.getElementById("newsForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("newsId").value;
    const title = document.getElementById("newsTitle").value.trim();
    const text = document.getElementById("newsText").value.trim();
    const date = document.getElementById("newsDate").value;
    const file = document.getElementById("newsImage").files[0];
    if (!title) return showToast("Введите заголовок", true);
    let image = document.getElementById("newsImageUrl").value;
    if (file) { showToast("Загрузка..."); image = await uploadToImgbb(file) || image; }
    const data = { title, text, image: image || "", date: date || new Date().toISOString().slice(0, 10) };
    try {
      if (id) { await db.ref("news/" + id).update(data); showToast("Обновлено"); }
      else { await db.ref("news").push(data); showToast("Добавлено"); }
      resetNewsForm(); await loadAdminData();
    } catch (err) { showToast(err.message, true); }
  });
}

function renderAdminNews() {
  const tbody = document.querySelector("#adminNewsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = cache.news
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(n => `<tr>
      <td><img src="${n.image || "https://via.placeholder.com/36"}" style="border-radius:6px" onerror="this.src='https://via.placeholder.com/36'"></td>
      <td>${n.title}</td>
      <td>${n.date || "—"}</td>
      <td>
        <button class="btn-save" style="padding:6px 10px;font-size:0.8rem" onclick="editNews('${n.id}')">✎</button>
        <button class="btn-danger" onclick="deleteItem('news','${n.id}')">✕</button>
      </td>
    </tr>`).join("") || "<tr><td colspan='4' style='text-align:center;opacity:0.5'>Нет новостей</td></tr>";
}

function editNews(id) {
  const n = cache.news.find(x => x.id === id);
  if (!n) return;
  document.getElementById("newsId").value = n.id;
  document.getElementById("newsTitle").value = n.title;
  document.getElementById("newsText").value = n.text || "";
  document.getElementById("newsDate").value = n.date || "";
  document.getElementById("newsImageUrl").value = n.image || "";
  document.getElementById("newsFormTitle").textContent = "Редактировать новость";
}

function resetNewsForm() {
  document.getElementById("newsForm").reset();
  document.getElementById("newsId").value = "";
  document.getElementById("newsImageUrl").value = "";
  document.getElementById("newsFormTitle").textContent = "Добавить новость";
}

// ===== РЕКЛАМА =====
function setupAdForm() {
  document.getElementById("adForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("adId").value;
    const link = document.getElementById("adLink").value.trim();
    const file = document.getElementById("adImage").files[0];
    let image = document.getElementById("adImageUrl").value;
    if (file) { showToast("Загрузка..."); image = await uploadToImgbb(file) || image; }
    if (!image) return showToast("Нужно изображение", true);
    const data = { image, link: link || "#" };
    try {
      if (id) { await db.ref("ads/" + id).update(data); showToast("Обновлено"); }
      else { await db.ref("ads").push(data); showToast("Добавлено"); }
      resetAdForm(); await loadAdminData();
    } catch (err) { showToast(err.message, true); }
  });
}

function renderAdminAds() {
  const tbody = document.querySelector("#adminAdsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = cache.ads.map(a => `<tr>
    <td><img src="${a.image}" style="width:80px;height:40px;object-fit:cover;border-radius:6px"></td>
    <td><a href="${a.link}" target="_blank" style="color:#60a5fa">${a.link || "—"}</a></td>
    <td>
      <button class="btn-save" style="padding:6px 10px;font-size:0.8rem" onclick="editAd('${a.id}')">✎</button>
      <button class="btn-danger" onclick="deleteItem('ads','${a.id}')">✕</button>
    </td>
  </tr>`).join("") || "<tr><td colspan='3' style='text-align:center;opacity:0.5'>Нет рекламы</td></tr>";
}

function editAd(id) {
  const a = cache.ads.find(x => x.id === id);
  if (!a) return;
  document.getElementById("adId").value = a.id;
  document.getElementById("adLink").value = a.link || "";
  document.getElementById("adImageUrl").value = a.image || "";
  document.getElementById("adFormTitle").textContent = "Редактировать рекламу";
}

function resetAdForm() {
  document.getElementById("adForm").reset();
  document.getElementById("adId").value = "";
  document.getElementById("adImageUrl").value = "";
  document.getElementById("adFormTitle").textContent = "Добавить рекламу";
}

// ===== ТУРНИРЫ =====
function setupTournamentForm() {
  document.getElementById("tournamentForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("tournamentId").value;
    const name = document.getElementById("tournamentName").value.trim();
    const season = document.getElementById("tournamentSeason").value.trim();
    const active = document.getElementById("tournamentActive").checked;
    if (!name) return showToast("Введите название", true);
    const data = { name, season, active };
    try {
      if (id) { await db.ref("tournaments/" + id).update(data); showToast("Обновлено"); }
      else { await db.ref("tournaments").push(data); showToast("Добавлено"); }
      resetTournamentForm(); await loadAdminData();
    } catch (err) { showToast(err.message, true); }
  });
}

function renderAdminTournaments() {
  const tbody = document.querySelector("#adminTournamentsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = cache.tournaments.map(t => `<tr>
    <td>${t.name}</td>
    <td>${t.season || "—"}</td>
    <td>${t.active ? "✅ Активен" : "—"}</td>
    <td>
      <button class="btn-save" style="padding:6px 10px;font-size:0.8rem" onclick="editTournament('${t.id}')">✎</button>
      <button class="btn-danger" onclick="deleteItem('tournaments','${t.id}')">✕</button>
    </td>
  </tr>`).join("") || "<tr><td colspan='4' style='text-align:center;opacity:0.5'>Нет турниров</td></tr>";
}

function editTournament(id) {
  const t = cache.tournaments.find(x => x.id === id);
  if (!t) return;
  document.getElementById("tournamentId").value = t.id;
  document.getElementById("tournamentName").value = t.name;
  document.getElementById("tournamentSeason").value = t.season || "";
  document.getElementById("tournamentActive").checked = !!t.active;
  document.getElementById("tournamentFormTitle").textContent = "Редактировать турнир";
}

function resetTournamentForm() {
  document.getElementById("tournamentForm").reset();
  document.getElementById("tournamentId").value = "";
  document.getElementById("tournamentFormTitle").textContent = "Добавить турнир";
}

async function deleteItem(path, id) {
  if (!confirm("Удалить запись?")) return;
  try {
    await db.ref(`${path}/${id}`).remove();
    showToast("Удалено");
    await loadAdminData();
  } catch (err) { showToast(err.message, true); }
}

// ===== ПРЕВЬЮ ФОТО =====
function setupPhotoPreviews() {
  const map = [
    { input: "playerPhoto", preview: "playerPhotoPreview", nameId: null },
    { input: "teamLogo", preview: "teamLogoPreview", nameId: null },
    { input: "newsImage", preview: null, nameId: null },
    { input: "adImage", preview: null, nameId: null }
  ];
  map.forEach(({ input, preview }) => {
    const el = document.getElementById(input);
    if (!el) return;
    // Ensure click works: if parent is label, fine; also allow button click
    const wrap = el.closest(".upload-btn");
    if (wrap) {
      wrap.addEventListener("click", e => {
        // let the input receive the click via opacity overlay
      });
    }
    el.addEventListener("change", () => {
      const file = el.files[0];
      if (!file) return;
      showToast("Файл выбран: " + file.name);
      if (preview) {
        const prev = document.getElementById(preview);
        if (prev) {
          prev.src = URL.createObjectURL(file);
          prev.style.display = "block";
          if (!document.getElementById("playerConsent")?.checked && input === "playerPhoto") {
            prev.classList.add("blurred");
          } else {
            prev.classList.remove("blurred");
          }
        }
      }
      // show filename next to button
      let nameEl = el.closest(".upload-btn-wrap")?.querySelector(".upload-filename");
      if (!nameEl && el.closest(".upload-btn-wrap")) {
        nameEl = document.createElement("span");
        nameEl.className = "upload-filename";
        el.closest(".upload-btn-wrap").appendChild(nameEl);
      }
      if (nameEl) nameEl.textContent = file.name;
    });
  });

  // Consent toggle updates preview blur
  document.getElementById("playerConsent")?.addEventListener("change", e => {
    const prev = document.getElementById("playerPhotoPreview");
    if (prev) prev.classList.toggle("blurred", !e.target.checked);
  });
}

// ===== КОМАНДА ТУРА =====
function fillTotwCheckboxes(selectedIds = []) {
  const box = document.getElementById("totwPlayersCheckboxes");
  if (!box) return;
  const selected = new Set(selectedIds);
  box.innerHTML = cache.players
    .slice()
    .sort((a, b) => ((b.goals || 0) + (b.assists || 0)) - ((a.goals || 0) + (a.assists || 0)))
    .map(p => {
      const team = cache.teams.find(t => t.id === p.teamId)?.name || "";
      const checked = selected.has(p.id) ? "checked" : "";
      return `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;background:rgba(255,255,255,0.03);font-size:0.85rem">
          <input type="checkbox" name="totwPlayer" value="${p.id}" ${checked} style="width:auto">
          <span>${p.name} <small style="opacity:0.5">(${team}) ${p.goals || 0}Г ${p.assists || 0}П</small></span>
        </label>
      `;
    }).join("") || "<p style='opacity:0.5'>Сначала добавьте игроков</p>";
}

function setupTotwForm() {
  document.getElementById("totwForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("totwId").value;
    const title = document.getElementById("totwTitle").value.trim();
    const round = Number(document.getElementById("totwRound").value) || 1;
    const players = [...document.querySelectorAll('input[name="totwPlayer"]:checked')].map(c => c.value);

    if (!title) return showToast("Введите название", true);
    if (!players.length) return showToast("Выберите хотя бы одного игрока", true);

    const data = { title, round, players };

    try {
      if (id) {
        await db.ref("teamOfTheRound/" + id).update(data);
        showToast("Команда тура обновлена");
      } else {
        await db.ref("teamOfTheRound").push(data);
        showToast("Команда тура добавлена");
      }
      resetTotwForm();
      await loadAdminData();
    } catch (err) {
      showToast(err.message, true);
    }
  });
}

function renderAdminTotw() {
  const tbody = document.querySelector("#adminTotwTable tbody");
  if (!tbody) return;
  tbody.innerHTML = cache.totw
    .sort((a, b) => (b.round || 0) - (a.round || 0))
    .map(t => `
      <tr>
        <td>${t.round || "—"}</td>
        <td>${t.title || "—"}</td>
        <td>${(t.players || []).length}</td>
        <td>
          <button class="btn-save" style="padding:6px 10px;font-size:0.8rem" onclick="editTotw('${t.id}')">✎</button>
          <button class="btn-danger" onclick="deleteItem('teamOfTheRound','${t.id}')">✕</button>
        </td>
      </tr>
    `).join("") || "<tr><td colspan='4' style='text-align:center;opacity:0.5'>Нет команд тура</td></tr>";
}

function editTotw(id) {
  const t = cache.totw.find(x => x.id === id);
  if (!t) return;
  document.getElementById("totwId").value = t.id;
  document.getElementById("totwTitle").value = t.title || "";
  document.getElementById("totwRound").value = t.round || 1;
  fillTotwCheckboxes(t.players || []);
  document.getElementById("totwFormTitle").textContent = "Редактировать команду тура";
  // switch to panel
  document.querySelectorAll(".admin-nav button").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-panel="totw"]')?.classList.add("active");
  document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
  document.getElementById("panel-totw")?.classList.add("active");
  document.getElementById("adminTitle").textContent = "⭐ Команда тура";
}

function resetTotwForm() {
  document.getElementById("totwForm")?.reset();
  document.getElementById("totwId").value = "";
  document.getElementById("totwFormTitle").textContent = "Добавить команду тура";
  fillTotwCheckboxes([]);
}


function setupStaffForm() {
  document.getElementById("staffForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("staffId").value;
    const name = document.getElementById("staffName").value.trim();
    const role = document.getElementById("staffRole").value;
    const teamId = document.getElementById("staffTeam")?.value || "";
    const file = document.getElementById("staffPhoto")?.files[0];
    if (!name) return showToast("Введите имя", true);
    let photo = document.getElementById("staffPhotoUrl").value;
    if (file) { showToast("Загрузка..."); photo = await uploadToImgbb(file) || photo; }
    const data = { name, role, teamId, photo: photo || "" };
    try {
      if (id) await db.ref("staff/" + id).update(data);
      else await db.ref("staff").push(data);
      showToast("Сохранено");
      document.getElementById("staffForm").reset();
      document.getElementById("staffId").value = "";
      await loadAdminData();
    } catch (err) { showToast(err.message, true); }
  });
}

function renderAdminStaff() {
  const tbody = document.querySelector("#adminStaffTable tbody");
  if (!tbody) return;
  tbody.innerHTML = cache.staff.map(s => `
    <tr>
      <td><img src="${s.photo || "https://via.placeholder.com/34"}"></td>
      <td>${s.name}</td>
      <td>${s.role || ""}</td>
      <td>
        <button class="btn-danger" onclick="deleteItem('staff','${s.id}')">✕</button>
      </td>
    </tr>
  `).join("") || "<tr><td colspan='4' style='text-align:center;opacity:.5'>Пусто</td></tr>";
}

function setupSettingsForm() {
  document.getElementById("settingsEmblem")?.addEventListener("change", e => {
    const f = e.target.files[0];
    if (f) {
      const prev = document.getElementById("settingsEmblemPreview");
      if (prev) { prev.src = URL.createObjectURL(f); prev.style.display = "block"; }
    }
  });
  document.getElementById("settingsForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const siteTitle = document.getElementById("settingsTitle").value.trim();
    const file = document.getElementById("settingsEmblem")?.files[0];
    let emblemUrl = document.getElementById("settingsEmblemUrl").value;
    if (file) {
      showToast("Загрузка эмблемы...");
      emblemUrl = await uploadToImgbb(file) || emblemUrl;
    }
    try {
      await db.ref("settings").update({ siteTitle, emblemUrl: emblemUrl || "" });
      document.getElementById("settingsEmblemUrl").value = emblemUrl || "";
      showToast("Оформление сохранено");
    } catch (err) { showToast(err.message, true); }
  });
}

function renderAdminSuggestions() {
  const tbody = document.querySelector("#adminSuggestionsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = cache.suggestions
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(s => `
      <tr>
        <td>${s.date ? new Date(s.date).toLocaleString("ru-RU") : "—"}</td>
        <td>${s.name || ""}</td>
        <td>${s.contact || ""}</td>
        <td style="max-width:240px;white-space:normal">${s.text || ""}</td>
        <td><button class="btn-danger" onclick="deleteItem('suggestions','${s.id}')">✕</button></td>
      </tr>
    `).join("") || "<tr><td colspan='5' style='text-align:center;opacity:.5'>Нет предложений</td></tr>";
}


function filterAdminTable(tableId, query) {
  const q = (query || "").trim().toLowerCase();
  const tbody = document.querySelector("#" + tableId + " tbody");
  if (!tbody) return;
  let visible = 0;
  tbody.querySelectorAll("tr").forEach(tr => {
    // skip empty placeholder rows with colspan
    const text = tr.textContent.toLowerCase();
    const show = !q || text.includes(q);
    tr.style.display = show ? "" : "none";
    if (show) visible++;
  });
}

function setupAdminSearch() {
  const binds = [
    ["adminTeamSearch", "adminTeamsTable"],
    ["adminPlayerSearch", "adminPlayersTable"],
    ["adminMatchSearch", "adminMatchesTable"],
    ["adminNewsSearch", "adminNewsTable"],
    ["adminStaffSearch", "adminStaffTable"],
    ["adminShopSearch", "adminShopTable"]
  ];
  binds.forEach(([inputId, tableId]) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    const run = () => filterAdminTable(tableId, input.value);
    input.addEventListener("input", run);
    input.addEventListener("search", run); // clear button in some browsers
  });
}


let adminShop = [];
async function loadAdminShop() {
  const snap = await db.ref("shop").once("value");
  adminShop = Object.entries(snap.val() || {}).map(([id, v]) => ({ id, ...v }));
}

function renderAdminShop() {
  const tbody = document.querySelector("#adminShopTable tbody");
  if (!tbody) return;
  tbody.innerHTML = adminShop.map(p => `
    <tr>
      <td><img src="${p.image || "https://via.placeholder.com/34"}"></td>
      <td>${p.name}</td>
      <td>${p.price || 0} ⭐</td>
      <td><button class="btn-danger" onclick="deleteItem('shop','${p.id}')">✕</button></td>
    </tr>
  `).join("") || "<tr><td colspan='4' style='text-align:center;opacity:.5'>Пусто</td></tr>";
}

function setupShopForm() {
  document.getElementById("shopForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("shopId").value;
    const name = document.getElementById("shopName").value.trim();
    const price = Number(document.getElementById("shopPrice").value) || 0;
    const description = document.getElementById("shopDesc").value.trim();
    const file = document.getElementById("shopImage")?.files[0];
    let image = document.getElementById("shopImageUrl").value;
    if (!name) return showToast("Введите название", true);
    if (file) {
      showToast("Загрузка...");
      image = await uploadToImgbb(file) || image;
    }
    const data = { name, price, description, image: image || "" };
    try {
      if (id) await db.ref("shop/" + id).update(data);
      else await db.ref("shop").push(data);
      showToast("Товар сохранён");
      document.getElementById("shopForm").reset();
      document.getElementById("shopId").value = "";
      await loadAdminShop();
      renderAdminShop();
    } catch (err) { showToast(err.message, true); }
  });
}
