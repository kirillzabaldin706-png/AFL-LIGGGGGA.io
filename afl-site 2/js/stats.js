function renderStats(players) {
  const scorersEl = document.getElementById("scorers-list");
  const assistsEl = document.getElementById("assists-list");
  if (!scorersEl || !assistsEl) return;

  const scorers = [...players]
    .filter(p => (p.goals || 0) > 0)
    .sort((a, b) => (b.goals || 0) - (a.goals || 0))
    .slice(0, 10);

  const assists = [...players]
    .filter(p => (p.assists || 0) > 0)
    .sort((a, b) => (b.assists || 0) - (a.assists || 0))
    .slice(0, 10);

  function makeItem(p, i, value) {
    const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
    const photo = getPlayerPhoto(p);
    return `
      <li data-player-id="${p.id}">
        <div class="stats-player">
          <span class="stats-rank ${rankClass}">${i + 1}</span>
          <img src="${photo.url}" alt="" class="${photo.blurred ? "blurred" : ""}"
               onerror="this.src='https://via.placeholder.com/36?text=?'">
          <div style="min-width:0">
            <span class="stats-name">${p.name}</span>
            ${p.teamName ? `<span class="stats-team-small">${p.teamName}</span>` : ""}
          </div>
        </div>
        <span class="stats-value">${value}</span>
      </li>
    `;
  }

  scorersEl.innerHTML = scorers.length
    ? scorers.map((p, i) => makeItem(p, i, p.goals || 0)).join("")
    : "<li style='opacity:0.5;cursor:default'>Нет данных</li>";

  assistsEl.innerHTML = assists.length
    ? assists.map((p, i) => makeItem(p, i, p.assists || 0)).join("")
    : "<li style='opacity:0.5;cursor:default'>Нет данных</li>";

  // Клик по игроку → модалка
  document.querySelectorAll("#scorers-list li[data-player-id], #assists-list li[data-player-id]").forEach(li => {
    li.addEventListener("click", () => {
      const id = li.dataset.playerId;
      const player = players.find(p => p.id === id);
      if (player) openPlayerModal(player);
    });
  });
}

async function loadPredictions(matches, teams) {
  const container = document.getElementById("predictions-list");
  if (!container) return;
  const upcoming = matches
    .filter(m => m.status !== "finished")
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 6);

  if (!upcoming.length) {
    container.innerHTML = "<p style='text-align:center;opacity:0.5'>Нет предстоящих матчей</p>";
    return;
  }

  container.innerHTML = "";
  upcoming.forEach(m => {
    const home = teams.find(t => t.id === m.homeId)?.name || "Хозяева";
    const away = teams.find(t => t.id === m.awayId)?.name || "Гости";
    const seed = (String(m.homeId) + String(m.awayId)).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const homeWin = 30 + (seed % 40);
    const draw = 15 + (seed % 20);
    const awayWin = Math.max(5, 100 - homeWin - draw);
    const confidence = homeWin > 55 ? "Высокая" : homeWin > 40 ? "Средняя" : "Низкая";

    const card = document.createElement("div");
    card.className = "prediction-card fade-in";
    card.innerHTML = `
      <div class="pred-header">
        <div class="pred-teams">${home} — ${away}</div>
        <span class="pred-confidence">${confidence}</span>
      </div>
      <div class="pred-bars">
        <div class="pred-bar-row">
          <span class="pred-label">П1</span>
          <div class="pred-bar-bg"><div class="pred-bar-fill home" style="width:${homeWin}%"></div></div>
          <span class="pred-percent">${homeWin}%</span>
        </div>
        <div class="pred-bar-row">
          <span class="pred-label">X</span>
          <div class="pred-bar-bg"><div class="pred-bar-fill draw" style="width:${draw}%"></div></div>
          <span class="pred-percent">${draw}%</span>
        </div>
        <div class="pred-bar-row">
          <span class="pred-label">П2</span>
          <div class="pred-bar-bg"><div class="pred-bar-fill away" style="width:${awayWin}%"></div></div>
          <span class="pred-percent">${awayWin}%</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}
