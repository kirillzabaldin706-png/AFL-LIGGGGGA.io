function renderMatches(matches, teams) {
  const container = document.getElementById("matches-list");
  if (!container) return;
  container.innerHTML = "";
  const sorted = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date));

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

    // Статистика матча (если есть)
    const hasStats = isFinished && (
      m.homeShots != null || m.awayShots != null ||
      m.homeCorners != null || m.yellowCards != null ||
      m.homePossession != null
    );

    let statsHtml = "";
    if (hasStats) {
      const rows = [];
      if (m.homePossession != null || m.awayPossession != null) {
        rows.push(`<div class="match-stat-item"><span class="ms-val">${m.homePossession ?? "—"}%</span><br>Владение<br><span class="ms-val">${m.awayPossession ?? "—"}%</span></div>`);
      }
      if (m.homeShots != null || m.awayShots != null) {
        rows.push(`<div class="match-stat-item"><span class="ms-val">${m.homeShots ?? 0}</span><br>Удары<br><span class="ms-val">${m.awayShots ?? 0}</span></div>`);
      }
      if (m.homeCorners != null || m.awayCorners != null) {
        rows.push(`<div class="match-stat-item"><span class="ms-val">${m.homeCorners ?? 0}</span><br>Угловые<br><span class="ms-val">${m.awayCorners ?? 0}</span></div>`);
      }
      if (rows.length) {
        statsHtml = `<div class="match-stats-row">${rows.join("")}</div>`;
      }
    }

    const card = document.createElement("div");
    card.className = "match-card fade-in";
    card.dataset.matchId = m.id;
    card.innerHTML = `
      <div class="match-date">${dateStr}</div>
      <div class="match-teams">
        <div class="match-team">${homeName}</div>
        <div class="match-score">${score}</div>
        <div class="match-team">${awayName}</div>
      </div>
      <div style="text-align:center">
        <span class="match-status ${isFinished ? "status-finished" : "status-scheduled"}">
          ${isFinished ? "Завершён" : "Скоро"}
        </span>
      </div>
      ${statsHtml}
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
    ? `<div style="font-size:2.2rem;font-weight:900;margin:12px 0">${m.homeScore ?? 0} : ${m.awayScore ?? 0}</div>`
    : `<div style="font-size:1.4rem;font-weight:700;margin:12px 0;opacity:0.6">vs</div>`;

  // Детальная статистика
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
  } else if (isFinished) {
    statsHtml = `<p style="opacity:0.5;text-align:center;margin-top:16px">Подробная статистика пока не заполнена</p>`;
  }

  // Авторы голов (текстовое поле)
  let scorersHtml = "";
  if (m.scorers) {
    scorersHtml = `<div style="margin-top:16px;font-size:0.9rem;color:var(--text-muted)">
      <strong style="color:var(--text)">Голы:</strong> ${m.scorers}
    </div>`;
  }

  overlay.querySelector(".modal-body").innerHTML = `
    <div style="text-align:center">
      <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">${dateStr}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap">
        <div style="font-weight:700;font-size:1.1rem;min-width:100px">${homeName}</div>
        ${score}
        <div style="font-weight:700;font-size:1.1rem;min-width:100px">${awayName}</div>
      </div>
      <span class="match-status ${isFinished ? "status-finished" : "status-scheduled"}" style="margin-top:8px">
        ${isFinished ? "Завершён" : "Скоро"}
      </span>
      ${scorersHtml}
    </div>
    ${statsHtml}
  `;
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}
