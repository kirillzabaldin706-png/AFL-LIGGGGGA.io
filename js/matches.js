const MATCHES_VISIBLE = 6;
let matchesExpanded = false;
let matchesCache = { list: [], teams: [] };

function teamLogoUrl(team) {
  return team?.logo || "https://via.placeholder.com/64?text=FC";
}

function stageBadge(stage) {
  if (!stage || stage === "regular" || stage === "group") return "";
  const labels = window.STAGE_LABELS || {
    r16: "1/8", qf: "1/4", sf: "1/2", final: "Финал", third: "За 3-е"
  };
  const t = labels[stage] || stage;
  return `<span class="match-stage-badge">${t}</span>`;
}

function renderMatches(matches, teams) {
  const container = document.getElementById("matches-list");
  if (!container) return;

  // Сохраняем данные в кэш при загрузке; при «Показать ещё» берём только из кэша
  if (Array.isArray(matches) && matches.length >= 0 && teams) {
    const all = Array.isArray(matches) ? matches : [];
    const regular = all.filter(m => !m.stage || m.stage === "regular" || m.stage === "group");
    // Если все матчи — плей-офф, показываем их здесь тоже
    const source = regular.length ? regular : all;
    const list = source.slice().sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
    matchesCache = { list, teams: Array.isArray(teams) ? teams : [] };
  }

  const list = matchesCache.list || [];
  const teamsList = matchesCache.teams || [];

  if (!list.length) {
    container.innerHTML = "<p style='text-align:center;opacity:0.5;grid-column:1/-1'>Матчей пока нет</p>";
    const more = document.getElementById("matches-show-more");
    if (more) more.style.display = "none";
    return;
  }

  const visible = matchesExpanded ? list : list.slice(0, MATCHES_VISIBLE);
  container.innerHTML = "";
  visible.forEach(m => {
    try {
      container.appendChild(buildMatchCard(m, teamsList));
    } catch (err) {
      console.warn("match card error", err, m);
    }
  });

  let moreWrap = document.getElementById("matches-show-more");
  if (!moreWrap) {
    moreWrap = document.createElement("div");
    moreWrap.id = "matches-show-more";
    moreWrap.className = "matches-show-more";
    // Вставляем сразу после сетки матчей
    container.insertAdjacentElement("afterend", moreWrap);
  }
  if (list.length > MATCHES_VISIBLE) {
    moreWrap.style.display = "block";
    moreWrap.innerHTML = `<button type="button" class="btn btn-primary" id="btnToggleMatches">
      ${matchesExpanded ? "Скрыть старые матчи" : `Показать ещё (${list.length - MATCHES_VISIBLE})`}
    </button>`;
    const btn = document.getElementById("btnToggleMatches");
    if (btn) {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        matchesExpanded = !matchesExpanded;
        // Только кэш — не передаём пустые аргументы
        renderMatches(null, null);
      };
    }
  } else {
    moreWrap.style.display = "none";
    moreWrap.innerHTML = "";
  }
}

function buildMatchCard(m, teams) {
  const home = teams.find(t => t.id === m.homeId);
  const away = teams.find(t => t.id === m.awayId);
  const isFinished = m.status === "finished";
  const score = isFinished ? `${m.homeScore ?? 0} : ${m.awayScore ?? 0}` : "vs";
  const dateStr = m.date
    ? new Date(m.date).toLocaleDateString("ru-RU", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
    : "";
  const live = m.streamUrl && (m.status === "live" || m.live);
  const card = document.createElement("div");
  card.className = "match-card fade-in";
  card.dataset.matchId = m.id;
  card.innerHTML = `
    <div class="match-date">${dateStr} ${stageBadge(m.stage)}
      ${live ? '<span class="live-dot">● LIVE</span>' : ""}
    </div>
    <div class="match-teams match-teams-logos">
      <div class="match-team-block">
        <img class="match-team-logo" src="${teamLogoUrl(home)}" alt=""
             onerror="this.src='https://via.placeholder.com/48?text=FC'">
        <div class="match-team">${home?.name || "—"}</div>
      </div>
      <div class="match-score">${score}</div>
      <div class="match-team-block">
        <img class="match-team-logo" src="${teamLogoUrl(away)}" alt=""
             onerror="this.src='https://via.placeholder.com/48?text=FC'">
        <div class="match-team">${away?.name || "—"}</div>
      </div>
    </div>
    <div style="text-align:center">
      <span class="match-status ${isFinished ? "status-finished" : "status-scheduled"}">
        ${isFinished ? "Завершён" : (live ? "В эфире" : "Скоро")}
      </span>
    </div>`;
  card.addEventListener("click", () => openMatchModal(m, home, away));
  return card;
}

function openMatchModal(m, home, away) {
  const overlay = document.getElementById("matchModal");
  if (!overlay) return;

  const isFinished = m.status === "finished";
  const homeName = home?.name || "Хозяева";
  const awayName = away?.name || "Гости";
  const dateStr = m.date
    ? new Date(m.date).toLocaleDateString("ru-RU", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
    : "";

  const score = isFinished
    ? `<div style="font-size:2.2rem;font-weight:900;margin:8px 0">${m.homeScore ?? 0} : ${m.awayScore ?? 0}</div>`
    : `<div style="font-size:1.4rem;font-weight:700;margin:8px 0;opacity:0.6">vs</div>`;

  const stats = [
    { lbl: "Владение %", h: m.homePossession, a: m.awayPossession },
    { lbl: "Удары", h: m.homeShots, a: m.awayShots },
    { lbl: "Удары в створ", h: m.homeShotsOn, a: m.awayShotsOn },
    { lbl: "Угловые", h: m.homeCorners, a: m.awayCorners },
    { lbl: "Жёлтые карточки", h: m.homeYellow, a: m.awayYellow },
    { lbl: "Красные карточки", h: m.homeRed, a: m.awayRed }
  ].filter(s => s.h != null || s.a != null);

  let statsHtml = "";
  if (stats.length) {
    statsHtml = `<h3 style="font-size:1rem;margin:20px 0 12px">Статистика матча</h3>
      <div class="match-detail-grid">` +
      stats.map(s => `
        <div class="match-detail-box" style="grid-column:1/-1;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px">
          <span class="md-val" style="text-align:right">${s.h ?? "—"}</span>
          <span class="md-lbl">${s.lbl}</span>
          <span class="md-val" style="text-align:left">${s.a ?? "—"}</span>
        </div>`).join("") + `</div>`;
  }

  const scorersHtml = m.scorers
    ? `<div style="margin-top:16px;font-size:0.9rem;color:var(--text-muted)">
        <strong style="color:var(--text)">Голы:</strong> ${m.scorers}</div>`
    : "";

  const stageHtml = m.stage && m.stage !== "regular"
    ? `<div style="margin-bottom:8px">${stageBadge(m.stage)}</div>` : "";

  const streamBtn = m.streamUrl
    ? `<button type="button" class="btn btn-primary" id="btnMatchStream" style="margin-top:10px">▶ Смотреть трансляцию</button>`
    : "";

  overlay.querySelector(".modal-body").innerHTML = `
    <div style="text-align:center">
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">${dateStr}</div>
      ${stageHtml}
      <div class="modal-match-teams">
        <div class="modal-team-col">
          <img src="${teamLogoUrl(home)}" alt="" class="modal-team-logo"
               onerror="this.src='https://via.placeholder.com/72?text=FC'">
          <div style="font-weight:700;font-size:1.05rem">${homeName}</div>
        </div>
        ${score}
        <div class="modal-team-col">
          <img src="${teamLogoUrl(away)}" alt="" class="modal-team-logo"
               onerror="this.src='https://via.placeholder.com/72?text=FC'">
          <div style="font-weight:700;font-size:1.05rem">${awayName}</div>
        </div>
      </div>
      <span class="match-status ${isFinished ? "status-finished" : "status-scheduled"}" style="margin-top:8px">
        ${isFinished ? "Завершён" : "Скоро"}
      </span>
      ${scorersHtml}
      <div style="margin-top:20px;display:flex;flex-direction:column;align-items:center;gap:8px">
        <button type="button" class="btn btn-primary" id="btnMatchPoster">📥 Скачать картинку для поста</button>
        ${streamBtn}
      </div>
    </div>
    ${statsHtml}`;
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";

  document.getElementById("btnMatchPoster")?.addEventListener("click", e => {
    e.stopPropagation();
    if (typeof openPosterThemePicker === "function") openPosterThemePicker(m, home, away);
    else if (typeof downloadMatchPoster === "function") downloadMatchPoster(m, home, away);
  });
  document.getElementById("btnMatchStream")?.addEventListener("click", e => {
    e.stopPropagation();
    openStreamPlayer(m.streamUrl, `${homeName} — ${awayName}`);
  });
}

function openStreamPlayer(url, title) {
  if (!url) return;
  let ov = document.getElementById("streamModal");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "streamModal";
    ov.className = "modal-overlay";
    ov.innerHTML = `<div class="modal" style="max-width:900px;width:95%">
      <button type="button" class="modal-close" id="streamModalClose">×</button>
      <div class="modal-body" id="streamModalBody"></div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener("click", e => { if (e.target === ov) closeStream(); });
    document.getElementById("streamModalClose").onclick = closeStream;
  }
  const body = document.getElementById("streamModalBody");
  const isYt = /youtube\.com|youtu\.be/.test(url);
  const isVk = /vk\.com|vkvideo/.test(url);
  let embed = "";
  if (isYt) {
    let id = "";
    const m1 = url.match(/[?&]v=([^&]+)/);
    const m2 = url.match(/youtu\.be\/([^?&]+)/);
    id = (m1 && m1[1]) || (m2 && m2[1]) || "";
    embed = id
      ? `<div class="stream-frame"><iframe src="https://www.youtube.com/embed/${id}?autoplay=1" allowfullscreen allow="autoplay;encrypted-media"></iframe></div>`
      : `<p><a href="${url}" target="_blank" rel="noopener">Открыть трансляцию</a></p>`;
  } else if (isVk || url.includes("iframe") || url.includes("embed")) {
    embed = `<div class="stream-frame"><iframe src="${url.replace("/video", "/video_ext.php").includes("http") ? url : url}" allowfullscreen></iframe></div>
      <p style="margin-top:8px;font-size:0.85rem"><a href="${url}" target="_blank" rel="noopener">Открыть в новой вкладке</a></p>`;
  } else {
    embed = `<p style="text-align:center;padding:20px">
      <a class="btn btn-primary" href="${url}" target="_blank" rel="noopener">Открыть трансляцию</a>
      <br><small style="opacity:0.6">Ссылка откроется в новой вкладке (Twitch, Kick и др.)</small>
    </p>`;
  }
  body.innerHTML = `<h3 style="margin-bottom:12px;text-align:center">${title || "Трансляция"}</h3>${embed}`;
  ov.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeStream() {
  const ov = document.getElementById("streamModal");
  if (!ov) return;
  ov.classList.remove("active");
  const body = document.getElementById("streamModalBody");
  if (body) body.innerHTML = "";
  document.body.style.overflow = "";
}

/** Анимированная лента ближайших матчей на главной
 * settings: { upcomingOn, upcomingTitle, upcomingMax }
 */
function renderUpcomingHero(matches, teams, settings) {
  const section = document.getElementById("upcoming");
  const el = document.getElementById("upcoming-ticker");
  if (!el) return;

  const s = settings || window.siteSettings || {};
  if (s.upcomingOn === false) {
    if (section) section.style.display = "none";
    return;
  }
  if (section) section.style.display = "";

  const titleEl = section?.querySelector(".section-title");
  if (titleEl) titleEl.textContent = s.upcomingTitle || "Ближайшие матчи";

  const maxN = Math.min(20, Math.max(1, Number(s.upcomingMax) || 8));
  const now = Date.now();

  let pool = (matches || [])
    .filter(m => m.status !== "finished")
    .filter(m => !m.date || new Date(m.date).getTime() >= now - 3 * 3600 * 1000);

  const featured = pool.filter(m => m.featured);
  if (featured.length) pool = featured;

  const upcoming = pool
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .slice(0, maxN);

  if (!upcoming.length) {
    el.innerHTML = "<div class='ticker-empty'>Ближайшие матчи появятся здесь</div>";
    return;
  }

  const items = upcoming.map(m => {
    const home = teams.find(t => t.id === m.homeId);
    const away = teams.find(t => t.id === m.awayId);
    const d = m.date
      ? new Date(m.date).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : "Скоро";
    const live = m.streamUrl && (m.status === "live" || m.live);
    return `<div class="ticker-item" data-mid="${m.id}">
      <span class="ticker-date">${d}</span>
      <img src="${teamLogoUrl(home)}" alt="" onerror="this.style.display='none'">
      <strong>${home?.name || "?"}</strong>
      <span class="ticker-vs">${live ? "● LIVE" : "vs"}</span>
      <strong>${away?.name || "?"}</strong>
      <img src="${teamLogoUrl(away)}" alt="" onerror="this.style.display='none'">
    </div>`;
  }).join("");

  // дублируем для бесконечной анимации
  el.innerHTML = `<div class="ticker-track">${items}${items}</div>`;
  el.querySelectorAll(".ticker-item").forEach(node => {
    node.addEventListener("click", () => {
      const m = matches.find(x => x.id === node.dataset.mid);
      if (!m) return;
      openMatchModal(m, teams.find(t => t.id === m.homeId), teams.find(t => t.id === m.awayId));
    });
  });
}

function renderPlayoffs(matches, teams) {
  const root = document.getElementById("playoffs-root");
  if (!root) return;
  const order = ["r16", "qf", "sf", "third", "final"];
  const playoffMatches = matches.filter(m => order.includes(m.stage));
  if (!playoffMatches.length) {
    root.innerHTML = "<p style='text-align:center;opacity:0.5'>Плей-офф пока не начался. Стадии матчей задаются в админке.</p>";
    return;
  }
  const labels = window.STAGE_LABELS || {
    r16: "1/8 финала", qf: "1/4 финала", sf: "1/2 финала",
    final: "Финал", third: "Матч за 3-е место"
  };
  let html = "";
  order.forEach(stage => {
    const list = playoffMatches.filter(m => m.stage === stage)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    if (!list.length) return;
    html += `<div class="playoff-round fade-in"><h3 class="playoff-round-title">${labels[stage]}</h3><div class="playoff-matches">`;
    list.forEach(m => {
      const home = teams.find(t => t.id === m.homeId);
      const away = teams.find(t => t.id === m.awayId);
      const isFinished = m.status === "finished";
      const score = isFinished ? `${m.homeScore ?? 0}:${m.awayScore ?? 0}` : "—";
      html += `<div class="playoff-match-card" data-mid="${m.id}">
        <div class="po-team"><img src="${teamLogoUrl(home)}" alt="" onerror="this.src='https://via.placeholder.com/36?text=FC'"><span>${home?.name || "TBD"}</span></div>
        <div class="po-score">${score}</div>
        <div class="po-team"><img src="${teamLogoUrl(away)}" alt="" onerror="this.src='https://via.placeholder.com/36?text=FC'"><span>${away?.name || "TBD"}</span></div>
      </div>`;
    });
    html += `</div></div>`;
  });
  root.innerHTML = html;
  root.querySelectorAll(".playoff-match-card").forEach(el => {
    el.addEventListener("click", () => {
      const m = matches.find(x => x.id === el.dataset.mid);
      if (!m) return;
      openMatchModal(m, teams.find(t => t.id === m.homeId), teams.find(t => t.id === m.awayId));
    });
  });
}

window.renderPlayoffs = renderPlayoffs;
window.renderUpcomingHero = renderUpcomingHero;
window.openStreamPlayer = openStreamPlayer;
