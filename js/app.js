// Глобальные данные для модалок
let globalTeams = [];
let globalPlayers = [];

document.addEventListener("DOMContentLoaded", () => {
  const burger = document.querySelector(".burger");
  const nav = document.querySelector("nav");
  if (burger && nav) {
    burger.addEventListener("click", () => {
      nav.classList.toggle("open");
      burger.classList.toggle("open");
    });
    nav.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => {
        nav.classList.remove("open");
        burger.classList.remove("open");
      });
    });
  }

  const goAdmin = () => { window.location.href = "admin.html"; };
  document.getElementById("adminBtn")?.addEventListener("click", goAdmin);
  document.getElementById("adminBtnMobile")?.addEventListener("click", goAdmin);

  // Закрытие модалок: закрывается только верхняя (игрок поверх команды)
  document.querySelectorAll(".modal-overlay").forEach(ov => {
    ov.addEventListener("click", e => {
      if (e.target === ov) closeTopModal();
    });
  });
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      closeTopModal();
    });
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeTopModal();
  });

  initScrollAnimations();
  loadAllData();
  setTimeout(initTableSorting, 500);
});

/** Порядок: выше = закрывается первым */
const MODAL_STACK_ORDER = ["authModal", "playerModal", "matchModal", "teamModal"];

function closeTopModal() {
  for (const id of MODAL_STACK_ORDER) {
    const el = document.getElementById(id);
    if (el && el.classList.contains("active")) {
      el.classList.remove("active");
      // Если ещё есть открытая модалка (например команда) — скролл не возвращаем
      const stillOpen = MODAL_STACK_ORDER.some(mid => {
        const m = document.getElementById(mid);
        return m && m.classList.contains("active");
      });
      if (!stillOpen) document.body.style.overflow = "";
      return;
    }
  }
  document.body.style.overflow = "";
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
  document.body.style.overflow = "";
}

async function loadAllData() {
  try {
    const [teamsSnap, matchesSnap, newsSnap, adsSnap, playersSnap, totwSnap, staffSnap, settingsSnap] = await Promise.all([
      db.ref("teams").once("value"),
      db.ref("matches").once("value"),
      db.ref("news").once("value"),
      db.ref("ads").once("value"),
      db.ref("players").once("value"),
      db.ref("teamOfTheRound").once("value"),
      db.ref("staff").once("value"),
      db.ref("settings").once("value")
    ]);

    const teams = Object.entries(teamsSnap.val() || {}).map(([id, t]) => ({ id, ...t }));
    const matches = Object.entries(matchesSnap.val() || {}).map(([id, m]) => ({ id, ...m }));
    const news = Object.entries(newsSnap.val() || {}).map(([id, n]) => ({ id, ...n }));
    const ads = Object.entries(adsSnap.val() || {}).map(([id, a]) => ({ id, ...a }));
    const players = Object.entries(playersSnap.val() || {}).map(([id, p]) => {
      const team = teams.find(t => t.id === p.teamId);
      return { id, ...p, teamName: team?.name || "" };
    });
    const totw = Object.entries(totwSnap.val() || {}).map(([id, t]) => ({ id, ...t }));

    globalTeams = teams;
    globalPlayers = players;
    window.globalTeams = teams;
    window.globalPlayers = players;

    // Только данные из Firebase — без демо-команд
    if (teams.length === 0) {
      console.log("Firebase: команд пока нет. Добавьте их в админке.");
    }

    const settings = settingsSnap.val() || {};
    window.siteSettings = settings;
    applySiteSettings(settings);

    renderMatches(matches, teams);
    if (typeof renderUpcomingHero === "function") renderUpcomingHero(matches, teams, settings);
    if (typeof renderPlayoffs === "function") renderPlayoffs(matches, teams);
    renderStats(players);
    renderTeams(teams);
    renderNews(news);
    renderAds(ads);
    loadPredictions(matches, teams);
    const staff = Object.entries(staffSnap.val() || {}).map(([id, s]) => ({ id, ...s }));
    // tournaments already loaded separately if needed
    let tournaments = [];
    try {
      const ts = await db.ref("tournaments").once("value");
      tournaments = Object.entries(ts.val() || {}).map(([id, x]) => {
        const t = { id, ...x };
        if (t.teamIds && !Array.isArray(t.teamIds)) t.teamIds = Object.values(t.teamIds).filter(Boolean);
        if (!Array.isArray(t.teamIds)) t.teamIds = [];
        return t;
      });
    } catch(e) {}

    renderTeamOfTheRound(totw, players);
    renderTournaments(tournaments);
    if (typeof renderStandingsByTournaments === "function") {
      renderStandingsByTournaments(matches, teams, tournaments);
    } else {
      renderStandings(calculateStandings(matches, teams));
    }
    renderStaff(staff);
    if (typeof setBetContext === "function") setBetContext(matches, teams);
    if (typeof loadShop === "function") loadShop();
    if (typeof window.__userSysInit === "undefined" && typeof initUserSystem === "function") {
      window.__userSysInit = true;
      initUserSystem();
    }
    window.globalStaff = staff;
    setTimeout(initScrollAnimations, 100);
  } catch (err) {
    console.error("Ошибка загрузки Firebase:", err);
    showToast("Не удалось загрузить данные из базы", true);
  }
}

function loadDemoData() {
  // Демо отключено — показываем пустые блоки
  console.warn("Демо-данные отключены. Используйте данные из Firebase.");
  globalTeams = [];
  globalPlayers = [];
  renderStandings([]);
  renderMatches([], []);
  renderStats([]);
  renderTeams([]);
  renderNews([]);
  renderAds([]);
  loadPredictions([], []);
  renderTeamOfTheRound([], []);
  if (typeof renderTournaments === "function") renderTournaments([]);
  if (typeof renderStaff === "function") renderStaff([]);
}


function renderTeams(teams) {
  const grid = document.getElementById("teams-grid");
  if (!grid) return;
  if (!teams || !teams.length) {
    grid.innerHTML = "<p style='text-align:center;opacity:0.5;grid-column:1/-1'>Команд пока нет. Добавьте их в админ-панели.</p>";
    return;
  }
  grid.innerHTML = teams.map(t => `
    <div class="team-card fade-in" data-team-id="${t.id}">
      <img src="${t.logo || "https://via.placeholder.com/220x160?text=Logo"}" alt="${t.name}"
           onerror="this.src='https://via.placeholder.com/220x160?text=Logo'">
      <div class="team-card-body">
        <h3>${t.name}</h3>
        <p>${t.city || ""}</p>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".team-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.teamId;
      const team = teams.find(t => t.id === id) || globalTeams.find(t => t.id === id);
      if (team) openTeamModal(team);
    });
  });
}

function renderNews(news) {
  const list = document.getElementById("news-list");
  if (!list) return;
  const sorted = [...news].sort((a, b) => new Date(b.date) - new Date(a.date));
  list.innerHTML = sorted.map(n => `
    <div class="news-card fade-in">
      <img src="${n.image || "https://via.placeholder.com/400x180?text=News"}" alt=""
           onerror="this.src='https://via.placeholder.com/400x180?text=News'">
      <div class="news-card-body">
        <div class="news-date">${n.date ? new Date(n.date).toLocaleDateString("ru-RU") : ""}</div>
        <h3>${n.title}</h3>
        <p>${(n.text || "").substring(0, 140)}${(n.text || "").length > 140 ? "..." : ""}</p>
      </div>
    </div>
  `).join("");
}

function renderAds(ads) {
  const container = document.getElementById("ads-container");
  if (!container) return;
  if (!ads.length) { container.innerHTML = ""; return; }
  container.innerHTML = ads.map(a => `
    <a href="${a.link || "#"}" target="_blank" class="ad-card" rel="noopener">
      <img src="${a.image}" alt="Реклама" onerror="this.style.display='none'">
    </a>
  `).join("");
}

function initScrollAnimations() {
  const elements = document.querySelectorAll(".fade-in");
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.1 });
  elements.forEach(el => observer.observe(el));
}

// ========== МОДАЛКА ИГРОКА ==========
function openPlayerModal(player) {
  const overlay = document.getElementById("playerModal");
  if (!overlay) return;
  if (!player) return;

  const photo = getPlayerPhoto(player);
  const age = player.birthYear ? (new Date().getFullYear() - Number(player.birthYear)) : "—";
  const goals = player.goals != null ? player.goals : 0;
  const assists = player.assists != null ? player.assists : 0;
  const number = player.number != null && player.number !== "" ? player.number : "—";
  const pos = player.position || "—";
  const team = player.teamName || "Без команды";
  const birth = player.birthYear || "—";
  const consent = !!player.consent;

  overlay.querySelector(".modal-body").innerHTML = `
    <div class="player-card-full">
      <div class="player-card-photo-wrap">
        <img class="player-card-photo ${photo.blurred ? "blurred" : ""}"
             src="${photo.url}"
             alt="${player.name || ""}"
             onerror="this.src='https://via.placeholder.com/200x200?text=?'">
        ${!consent ? '<div class="photo-blur-note">Фото скрыто: нет согласия на публикацию</div>' : ""}
      </div>
      <div class="player-card-main">
        <h2 class="player-card-name">${player.name || "Игрок"}</h2>
        <div class="player-card-team">${team}</div>
        <div class="consent-badge ${consent ? "consent-yes" : "consent-no"}">
          ${consent ? "✓ Согласие на фото получено" : "⚠ Нет согласия на публикацию фото"}
        </div>
      </div>
    </div>

    <div class="modal-stats-row">
      <div class="modal-stat-box"><div class="val">${goals}</div><div class="lbl">Голы</div></div>
      <div class="modal-stat-box"><div class="val">${assists}</div><div class="lbl">Передачи</div></div>
      <div class="modal-stat-box"><div class="val">#${number}</div><div class="lbl">Номер</div></div>
    </div>

    <ul class="modal-detail-list">
      <li><span>Позиция</span><span><strong>${pos}</strong></span></li>
      <li><span>Год рождения</span><span><strong>${birth}</strong></span></li>
      <li><span>Возраст</span><span><strong>${age}</strong></span></li>
      <li><span>Команда</span><span><strong>${team}</strong></span></li>
      <li><span>Голы</span><span><strong>${goals}</strong></span></li>
      <li><span>Голевые передачи</span><span><strong>${assists}</strong></span></li>
      <li><span>Игровой номер</span><span><strong>${number}</strong></span></li>
      <li><span>Согласие на фото</span><span><strong>${consent ? "Да" : "Нет"}</strong></span></li>
    </ul>
  `;
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

// ========== МОДАЛКА КОМАНДЫ ==========
function openTeamModal(team) {
  const overlay = document.getElementById("teamModal");
  if (!overlay) return;
  const roster = globalPlayers.filter(p => p.teamId === team.id);
  const teamStaff = (window.globalStaff || []).filter(s => s.teamId === team.id);

  let rosterHtml = "";
  if (roster.length === 0) {
    rosterHtml = "<p style='opacity:0.5;text-align:center;padding:20px'>Нет заявленных игроков</p>";
  } else {
    rosterHtml = `<div class="roster-grid">` + roster.map(p => {
      const photo = getPlayerPhoto(p);
      return `
        <div class="roster-player" data-player-id="${p.id}">
          <img src="${photo.url}" class="${photo.blurred ? "blurred" : ""}"
               onerror="this.src='https://via.placeholder.com/56?text=?'">
          <div class="name">${p.name}</div>
          <div class="pos">${p.position || ""} ${p.number ? "· #" + p.number : ""}</div>
        </div>
      `;
    }).join("") + `</div>`;
  }

  let staffHtml = "";
  if (teamStaff.length) {
    staffHtml = `<h3 style="margin:20px 0 12px;font-size:1rem;color:var(--primary)">Персонал команды</h3>
      <div class="staff-grid">` + teamStaff.map(s => `
        <div class="staff-card">
          <img src="${s.photo || "https://via.placeholder.com/64?text=?"}" alt=""
               onerror="this.src='https://via.placeholder.com/64?text=?'">
          <div class="sname">${s.name}</div>
          <div class="srole">${s.role || ""}</div>
        </div>
      `).join("") + `</div>`;
  } else {
    staffHtml = `<h3 style="margin:20px 0 12px;font-size:1rem;color:var(--primary)">Персонал команды</h3>
      <p style="opacity:0.5;text-align:center">Тренеры, врачи и фотографы пока не добавлены. Укажите команду в админке → Персонал.</p>`;
  }

  overlay.querySelector(".modal-body").innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <img src="${team.logo || "https://via.placeholder.com/80?text=FC"}" alt=""
           style="width:80px;height:80px;border-radius:50%;object-fit:cover;background:#e2e8f0"
           onerror="this.src='https://via.placeholder.com/80?text=FC'">
      <h2 style="margin-top:12px">${team.name}</h2>
      <p style="color:var(--text-muted)">${team.city || ""}</p>
    </div>
    <h3 style="margin-bottom:12px;font-size:1rem;color:var(--primary)">Состав</h3>
    ${rosterHtml}
    ${staffHtml}
  `;

  overlay.querySelectorAll(".roster-player[data-player-id]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const player = globalPlayers.find(p => p.id === el.dataset.playerId);
      if (player) openPlayerModal(player);
    });
  });

  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

// ========== КОМАНДА ТУРА ==========
// Авто-расчёт сбалансированного состава по позициям
function autoSelectTeamOfTheRound(players) {
  const scored = [...players].map(p => ({
    ...p,
    score: (Number(p.goals) || 0) * 2 + (Number(p.assists) || 0)
  })).filter(p => p.score > 0 || p.position)
    .sort((a, b) => b.score - a.score);

  const byPos = {
    "Вратарь": [],
    "Защитник": [],
    "Полузащитник": [],
    "Нападающий": [],
    other: []
  };
  scored.forEach(p => {
    const pos = p.position || "";
    if (byPos[pos]) byPos[pos].push(p);
    else byPos.other.push(p);
  });

  // Формат 8×8: 1-3-3-1
  const pick = (arr, n) => arr.slice(0, n);
  const selected = [];
  selected.push(...pick(byPos["Вратарь"], 1));
  selected.push(...pick(byPos["Защитник"], 3));
  selected.push(...pick(byPos["Полузащитник"], 3));
  selected.push(...pick(byPos["Нападающий"], 1));

  const ids = new Set(selected.map(p => p.id));
  for (const p of scored) {
    if (selected.length >= 8) break;
    if (!ids.has(p.id)) { selected.push(p); ids.add(p.id); }
  }
  if (selected.length < 5) {
    for (const p of players) {
      if (selected.length >= 8) break;
      if (!ids.has(p.id)) { selected.push({ ...p, score: 0 }); ids.add(p.id); }
    }
  }
  return selected.slice(0, 8);
}

function renderTeamOfTheRound(totwList, players) {
  const container = document.getElementById("totw-list");
  const label = document.getElementById("totw-round-label");
  const tabsEl = document.getElementById("totw-tabs");
  if (!container) return;

  const sorted = [...(totwList || [])].sort((a, b) => {
    // сезон / год выше, потом по round
    const rank = { season: 3, tournament: 2, round: 1 };
    const ra = rank[a.kind] || 1;
    const rb = rank[b.kind] || 1;
    if (rb !== ra) return rb - ra;
    return (b.round || 0) - (a.round || 0);
  });

  const renderPitch = (list, titleText) => {
    if (label) label.textContent = titleText || "";
    if (!list.length) {
      container.innerHTML = "<p style='text-align:center;opacity:0.5'>Пока нет данных для состава</p>";
      return;
    }
    const groups = { "Вратарь": [], "Защитник": [], "Полузащитник": [], "Нападающий": [], "": [] };
    list.forEach(p => {
      const pos = p.position || "";
      if (groups[pos] !== undefined) groups[pos].push(p);
      else groups[""].push(p);
    });
    const renderCard = (p) => {
      const photo = typeof getPlayerPhoto === "function" ? getPlayerPhoto(p) : { url: p.photo || "https://via.placeholder.com/72?text=?", blurred: !p.consent };
      const g = p.goals || 0, a = p.assists || 0;
      return `<div class="pitch-player" data-player-id="${p.id}">
        <div class="pitch-photo-wrap">
          <img src="${photo.url}" class="${photo.blurred ? "blurred" : ""}" alt=""
               onerror="this.src='https://via.placeholder.com/72?text=?'">
        </div>
        <div class="pname">${p.name}</div>
        <div class="pstats">${g}Г · ${a}П</div>
      </div>`;
    };
    let html = "";
    const lines = [
      ["Нападающий", groups["Нападающий"]],
      ["Полузащитник", groups["Полузащитник"]],
      ["Защитник", groups["Защитник"]],
      ["Вратарь", groups["Вратарь"]]
    ];
    lines.forEach(([lab, arr]) => {
      if (!arr.length) return;
      html += `<div class="pitch-label">${lab}</div><div class="pitch-line">`;
      arr.forEach(p => { html += renderCard(p); });
      html += `</div>`;
    });
    if (groups[""].length) {
      html += `<div class="pitch-line">`;
      groups[""].forEach(p => { html += renderCard(p); });
      html += `</div>`;
    }
    container.innerHTML = html;
    container.querySelectorAll(".pitch-player[data-player-id]").forEach(el => {
      el.addEventListener("click", () => {
        const player = players.find(p => p.id === el.dataset.playerId);
        if (player && typeof openPlayerModal === "function") openPlayerModal(player);
      });
    });
  };

  const resolvePlayers = (entry) => {
    if (!entry || !entry.players) return [];
    const ids = Array.isArray(entry.players) ? entry.players : Object.values(entry.players || {});
    return ids.map(pid => players.find(pl => pl.id === pid) || { id: pid, name: "?", consent: false });
  };

  if (!sorted.length) {
    if (tabsEl) tabsEl.innerHTML = "";
    const auto = typeof autoSelectTeamOfTheRound === "function" ? autoSelectTeamOfTheRound(players) : [];
    renderPitch(auto, "Авто-расчёт по статистике сезона");
    return;
  }

  // Вкладки, если составов больше одного
  if (tabsEl) {
    if (sorted.length > 1) {
      tabsEl.innerHTML = sorted.map((t, i) =>
        `<button type="button" class="totw-tab${i === 0 ? " active" : ""}" data-idx="${i}">${t.title || ("Состав " + (i + 1))}</button>`
      ).join("");
      tabsEl.querySelectorAll(".totw-tab").forEach(btn => {
        btn.addEventListener("click", () => {
          tabsEl.querySelectorAll(".totw-tab").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const entry = sorted[Number(btn.dataset.idx)];
          renderPitch(resolvePlayers(entry), entry.title || "Лучший состав");
        });
      });
    } else {
      tabsEl.innerHTML = "";
    }
  }

  const current = sorted[0];
  renderPitch(resolvePlayers(current), current.title || "Лучший состав");
}


function renderTournaments(list) {
  const el = document.getElementById("tournaments-list");
  if (!el) return;
  if (!list || !list.length) {
    el.innerHTML = "<p style='text-align:center;opacity:0.5;grid-column:1/-1'>Турниры пока не добавлены</p>";
    return;
  }
  el.innerHTML = list.map(t => `
    <div class="tournament-card fade-in">
      ${t.logo ? `<img class="tournament-logo" src="${t.logo}" alt="" onerror="this.style.display='none'">` : ""}
      <h3>${t.name}</h3>
      <div class="season">${t.season || ""}</div>
      ${t.active ? '<span class="badge-active">Активен</span>' : ""}
    </div>
  `).join("");
}

// ========== ПЕРСОНАЛ ==========
function renderStaff(list) {
  const el = document.getElementById("staff-list");
  if (!el) return;
  if (!list || !list.length) {
    el.innerHTML = "<p style='text-align:center;opacity:0.5;grid-column:1/-1'>Персонал пока не добавлен</p>";
    return;
  }
  el.innerHTML = list.map(s => `
    <div class="staff-card fade-in">
      <img src="${s.photo || "https://via.placeholder.com/64?text=?"}" alt=""
           onerror="this.src='https://via.placeholder.com/64?text=?'">
      <div class="sname">${s.name}</div>
      <div class="srole">${s.role || ""}</div>
    </div>
  `).join("");
}

// ========== ФОН / ЭМБЛЕМА ==========
function applySiteSettings(settings) {
  if (!settings) return;
  if (settings.emblemUrl) {
    document.body.classList.add("has-bg-emblem");
    document.body.style.setProperty("--site-emblem", `url("${settings.emblemUrl}")`);
  }
  if (settings.siteTitle) {
    const h = document.querySelector(".hero h1");
    if (h) h.textContent = settings.siteTitle;
  }
}

// ========== ПРЕДЛОЖЕНИЯ ==========
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("suggestForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const name = document.getElementById("suggestName").value.trim();
    const contact = document.getElementById("suggestContact").value.trim();
    const text = document.getElementById("suggestText").value.trim();
    if (!name || !contact || !text) return showToast("Заполните все поля", true);
    try {
      await db.ref("suggestions").push({
        name, contact, text,
        date: new Date().toISOString(),
        read: false
      });
      showToast("Предложение отправлено!");
      e.target.reset();
    } catch (err) {
      // fallback if rules block anonymous write - need open write for suggestions
      showToast("Ошибка: " + err.message, true);
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  if (typeof initUserSystem === "function" && !window.__userSysInit) {
    window.__userSysInit = true;
    initUserSystem();
  }
  if (typeof loadShop === "function") loadShop();
});


// ========== LIGHTBOX: фото на весь экран ==========
function openLightbox(src, caption) {
  if (!src || src.includes("placeholder")) return;
  let ov = document.getElementById("imgLightbox");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "imgLightbox";
    ov.className = "img-lightbox";
    ov.innerHTML = `
      <button type="button" class="img-lightbox-close" aria-label="Закрыть">×</button>
      <img class="img-lightbox-img" alt="">
      <div class="img-lightbox-cap"></div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", e => {
      if (e.target === ov || e.target.classList.contains("img-lightbox-close")) closeLightbox();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeLightbox();
    });
  }
  const img = ov.querySelector(".img-lightbox-img");
  const cap = ov.querySelector(".img-lightbox-cap");
  img.src = src;
  cap.textContent = caption || "";
  ov.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const ov = document.getElementById("imgLightbox");
  if (!ov) return;
  ov.classList.remove("open");
  const img = ov.querySelector(".img-lightbox-img");
  if (img) img.src = "";
  document.body.style.overflow = "";
}

function initImageLightbox() {
  if (window.__lightboxInit) return;
  window.__lightboxInit = true;
  document.addEventListener("click", e => {
    const t = e.target;
    if (!t || t.tagName !== "IMG") return;
    if (t.classList.contains("blurred")) return;
    if (t.closest(".header") || t.closest(".bet-slip-modal") || t.closest(".admin-layout")) return;
    if (t.closest("#cookie-banner")) return;
    const src = t.currentSrc || t.src;
    if (!src || src.includes("placeholder") || src.includes("via.placeholder")) return;
    if (t.classList.contains("modal-team-logo") || t.classList.contains("match-team-logo")) {
      e.stopPropagation();
      openLightbox(src, t.alt || "");
      return;
    }
    if (t.closest(".news-card") || t.closest(".ads-banner") || t.closest(".ads-list") ||
        t.closest(".team-card") || t.classList.contains("player-card-photo") ||
        t.classList.contains("modal-player-photo") || t.closest(".pitch-photo-wrap") ||
        t.closest(".staff-card") || t.classList.contains("tournament-logo") ||
        t.closest(".shop-card") || t.classList.contains("lightboxable")) {
      e.preventDefault();
      e.stopPropagation();
      const caption = t.alt || t.closest(".news-card")?.querySelector("h3, .news-title")?.textContent || "";
      openLightbox(src, (caption || "").trim());
    }
  }, true);
}

window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.initImageLightbox = initImageLightbox;
try {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initImageLightbox);
  else initImageLightbox();
} catch (e) {}
