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
  container.innerHTML = "";

  // Обычные матчи (не плей-офф) — или все, если плей-офф отдельно
  const regular = matches.filter(m => !m.stage || m.stage === "regular" || m.stage === "group");
  const list = regular.length ? regular : matches;
  const sorted = [...list].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!sorted.length) {
    container.innerHTML = "<p style='text-align:center;opacity:0.5;grid-column:1/-1'>Матчей пока нет</p>";
    return;
  }

  sorted.forEach(m => {
    const home = teams.find(t => t.id === m.homeId);
    const away = teams.find(t => t.id === m.awayId);
    const homeName = home?.name || "—";
    const awayName = away?.name || "—";
    const isFinished = m.status === "finished";
    const score = isFinished ? `${m.homeScore ?? 0} : ${m.awayScore ?? 0}` : "vs";
    const dateStr = m.date
      ? new Date(m.date).toLocaleDateString("ru-RU", {
          day: "numeric", month: "long", year: "numeric",
          hour: "2-digit", minute: "2-digit"
        })
      : "";

    const card = document.createElement("div");
    card.className = "match-card fade-in";
    card.dataset.matchId = m.id;
    card.innerHTML = `
      <div class="match-date">${dateStr} ${stageBadge(m.stage)}</div>
      <div class="match-teams match-teams-logos">
        <div class="match-team-block">
          <img class="match-team-logo" src="${teamLogoUrl(home)}" alt=""
               onerror="this.src='https://via.placeholder.com/48?text=FC'">
          <div class="match-team">${homeName}</div>
        </div>
        <div class="match-score">${score}</div>
        <div class="match-team-block">
          <img class="match-team-logo" src="${teamLogoUrl(away)}" alt=""
               onerror="this.src='https://via.placeholder.com/48?text=FC'">
          <div class="match-team">${awayName}</div>
        </div>
      </div>
      <div style="text-align:center">
        <span class="match-status ${isFinished ? "status-finished" : "status-scheduled"}">
          ${isFinished ? "Завершён" : "Скоро"}
        </span>
      </div>
    `;
    card.addEventListener("click", () => openMatchModal(m, home, away));
    container.appendChild(card);
  });
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
    { lbl: "Фолы", h: m.homeFouls, a: m.awayFouls },
    { lbl: "Жёлтые карточки", h: m.homeYellow, a: m.awayYellow },
    { lbl: "Красные карточки", h: m.homeRed, a: m.awayRed },
    { lbl: "Офсайды", h: m.homeOffsides, a: m.awayOffsides }
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
        </div>
      `).join("") + `</div>`;
  }

  let scorersHtml = "";
  if (m.scorers) {
    scorersHtml = `<div style="margin-top:16px;font-size:0.9rem;color:var(--text-muted)">
      <strong style="color:var(--text)">Голы:</strong> ${m.scorers}
    </div>`;
  }

  const stageHtml = m.stage && m.stage !== "regular"
    ? `<div style="margin-bottom:8px">${stageBadge(m.stage)}</div>`
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
      <div style="margin-top:20px">
        <button type="button" class="btn btn-primary" id="btnMatchPoster">
          📥 Скачать картинку для поста
        </button>
      </div>
    </div>
    ${statsHtml}
  `;
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";

  const btn = document.getElementById("btnMatchPoster");
  if (btn) {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      if (typeof downloadMatchPoster === "function") downloadMatchPoster(m, home, away);
      else alert("Модуль постера не загружен");
    });
  }
}

/** Сетка плей-офф на сайте */
function renderPlayoffs(matches, teams) {
  const root = document.getElementById("playoffs-root");
  if (!root) return;

  const order = ["r16", "qf", "sf", "third", "final"];
  const playoffMatches = matches.filter(m => order.includes(m.stage));
  if (!playoffMatches.length) {
    root.innerHTML = "<p style='text-align:center;opacity:0.5'>Плей-офф пока не начался. Матчи 1/8, 1/4, 1/2 и финал задаются в админке.</p>";
    return;
  }

  const labels = window.STAGE_LABELS || {
    r16: "1/8 финала", qf: "1/4 финала", sf: "1/2 финала",
    final: "Финал", third: "Матч за 3-е место"
  };

  let html = "";
  order.forEach(stage => {
    const list = playoffMatches
      .filter(m => m.stage === stage)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    if (!list.length) return;
    html += `<div class="playoff-round fade-in">
      <h3 class="playoff-round-title">${labels[stage] || stage}</h3>
      <div class="playoff-matches">`;
    list.forEach(m => {
      const home = teams.find(t => t.id === m.homeId);
      const away = teams.find(t => t.id === m.awayId);
      const isFinished = m.status === "finished";
      const score = isFinished ? `${m.homeScore ?? 0}:${m.awayScore ?? 0}` : "—";
      html += `<div class="playoff-match-card" data-mid="${m.id}">
        <div class="po-team">
          <img src="${teamLogoUrl(home)}" alt="" onerror="this.src='https://via.placeholder.com/36?text=FC'">
          <span>${home?.name || "TBD"}</span>
        </div>
        <div class="po-score">${score}</div>
        <div class="po-team">
          <img src="${teamLogoUrl(away)}" alt="" onerror="this.src='https://via.placeholder.com/36?text=FC'">
          <span>${away?.name || "TBD"}</span>
        </div>
      </div>`;
    });
    html += `</div></div>`;
  });

  root.innerHTML = html || "<p style='text-align:center;opacity:0.5'>Нет матчей плей-офф</p>";

  root.querySelectorAll(".playoff-match-card").forEach(el => {
    el.addEventListener("click", () => {
      const m = matches.find(x => x.id === el.dataset.mid);
      if (!m) return;
      const home = teams.find(t => t.id === m.homeId);
      const away = teams.find(t => t.id === m.awayId);
      openMatchModal(m, home, away);
    });
  });
}

window.renderPlayoffs = renderPlayoffs;
