/**
 * Турнирные таблицы: отдельная таблица на каждый турнир.
 * Матчи без tournamentId попадают в блок «Без турнира».
 */

/** Firebase иногда отдаёт массив как объект {0: id, 1: id} */
function normalizeIdList(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "object") return Object.values(val).filter(Boolean);
  return [];
}

function calculateStandings(matches, teams, tournamentId, enrolledTeamIds) {
  const table = {};
  const enrolled = normalizeIdList(enrolledTeamIds);
  const enroll = enrolled.length ? new Set(enrolled) : null;

  const baseTeams = enroll
    ? teams.filter(t => enroll.has(t.id))
    : teams;

  baseTeams.forEach(t => {
    table[t.id] = {
      id: t.id, name: t.name, logo: t.logo || "",
      played: 0, win: 0, draw: 0, lose: 0, gf: 0, ga: 0, points: 0, form: []
    };
  });

  const sortedMatches = [...matches]
    .filter(m => m.status === "finished")
    .filter(m => {
      if (tournamentId === "__none__") return !m.tournamentId;
      if (tournamentId) return m.tournamentId === tournamentId;
      return true;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedMatches.forEach(m => {
    // если команда сыграла, но не в списке участников — всё равно добавим в таблицу
    [m.homeId, m.awayId].forEach(tid => {
      if (!table[tid]) {
        const tm = teams.find(x => x.id === tid);
        if (tm) {
          table[tid] = {
            id: tm.id, name: tm.name, logo: tm.logo || "",
            played: 0, win: 0, draw: 0, lose: 0, gf: 0, ga: 0, points: 0, form: []
          };
        }
      }
    });
    const home = table[m.homeId];
    const away = table[m.awayId];
    if (!home || !away) return;
    const hs = Number(m.homeScore) || 0;
    const as = Number(m.awayScore) || 0;
    home.played++; away.played++;
    home.gf += hs; home.ga += as;
    away.gf += as; away.ga += hs;
    if (hs > as) {
      home.win++; home.points += 3; away.lose++;
      home.form.push("W"); away.form.push("L");
    } else if (hs < as) {
      away.win++; away.points += 3; home.lose++;
      home.form.push("L"); away.form.push("W");
    } else {
      home.draw++; away.draw++; home.points++; away.points++;
      home.form.push("D"); away.form.push("D");
    }
  });

  Object.values(table).forEach(t => { t.form = t.form.slice(-5); });

  let rows = Object.values(table);
  // Если задан список участников — показываем всех (даже 0 игр). Иначе только сыгравшие.
  if (!enroll) {
    rows = rows.filter(t => t.played > 0);
  }

  return rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });
}

let standingsByTournament = {}; // id -> rows
let currentStandingsTab = null;

function standingsTableHTML(tableId) {
  return `
    <div class="table-wrapper">
      <table class="standings-table" id="${tableId}">
        <thead>
          <tr>
            <th>#</th>
            <th class="sortable" data-sort="name">Команда</th>
            <th class="sortable" data-sort="played">И</th>
            <th class="sortable" data-sort="win">В</th>
            <th class="sortable" data-sort="draw">Н</th>
            <th class="sortable" data-sort="lose">П</th>
            <th class="sortable" data-sort="gd">Мячи</th>
            <th class="sortable sort-desc" data-sort="points">О</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>`;
}

function fillStandingsTbody(tbody, standings) {
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!standings.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;opacity:0.6;padding:20px">Нет завершённых матчей</td></tr>`;
    return;
  }
  standings.forEach((t, i) => {
    const pos = i + 1;
    const posClass = pos === 1 ? "pos-1" : pos === 2 ? "pos-2" : pos === 3 ? "pos-3" : "";
    const gd = t.gf - t.ga;
    const gdStr = gd > 0 ? `+${gd}` : String(gd);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="${posClass}">${pos}</td>
      <td>
        <div class="team-cell">
          <img src="${t.logo || "https://via.placeholder.com/28?text=FC"}" alt="${t.name}"
               onerror="this.src='https://via.placeholder.com/28?text=FC'">
          <span>${t.name}</span>
        </div>
      </td>
      <td>${t.played}</td>
      <td>${t.win}</td>
      <td>${t.draw}</td>
      <td>${t.lose}</td>
      <td>${t.gf}:${t.ga} <small style="opacity:0.6">(${gdStr})</small></td>
      <td class="points-cell">${t.points}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Рисует вкладки и таблицы по турнирам.
 * @param {Array} matches
 * @param {Array} teams
 * @param {Array} tournaments — { id, name, season, active }
 */
function renderStandingsByTournaments(matches, teams, tournaments) {
  const root = document.getElementById("standings-root");
  if (!root) {
    // fallback на старую одну таблицу
    const legacy = calculateStandings(matches, teams);
    renderStandings(legacy);
    return;
  }

  const list = Array.isArray(tournaments) ? [...tournaments] : [];
  // Активные сверху, потом по имени
  list.sort((a, b) => {
    if (!!b.active !== !!a.active) return b.active ? 1 : -1;
    return (a.name || "").localeCompare(b.name || "");
  });

  const hasOrphan = matches.some(m => m.status === "finished" && !m.tournamentId);
  const tabs = list.map(t => ({
    id: t.id,
    title: t.name + (t.season ? ` (${t.season})` : "") + (t.active ? " · активный" : "")
  }));
  if (hasOrphan) tabs.push({ id: "__none__", title: "Без турнира" });
  if (!tabs.length) {
    tabs.push({ id: "__all__", title: "Общая таблица" });
  }

  const tournamentMap = {};
  list.forEach(t => { tournamentMap[t.id] = t; });

  standingsByTournament = {};
  tabs.forEach(tab => {
    if (tab.id === "__all__") {
      standingsByTournament[tab.id] = calculateStandings(matches, teams, null, null);
    } else if (tab.id === "__none__") {
      standingsByTournament[tab.id] = calculateStandings(matches, teams, "__none__", null);
    } else {
      const enrolled = normalizeIdList(tournamentMap[tab.id]?.teamIds);
      standingsByTournament[tab.id] = calculateStandings(matches, teams, tab.id, enrolled);
    }
  });

  // Выбрать вкладку: активный турнир, иначе первая
  const activeT = list.find(t => t.active);
  if (!currentStandingsTab || !standingsByTournament[currentStandingsTab]) {
    currentStandingsTab = activeT ? activeT.id : tabs[0].id;
  }

  root.innerHTML = `
    <div class="standings-tabs" id="standings-tabs" role="tablist"></div>
    <div id="standings-panels"></div>
    <p style="text-align:center;margin-top:10px;font-size:0.8rem;color:var(--text-muted)">
      У каждого турнира своя таблица. Матчу в админке нужно указать турнир.
    </p>
  `;

  const tabsEl = document.getElementById("standings-tabs");
  const panelsEl = document.getElementById("standings-panels");

  tabs.forEach(tab => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "standings-tab" + (tab.id === currentStandingsTab ? " active" : "");
    btn.textContent = tab.title;
    btn.dataset.tid = tab.id;
    btn.addEventListener("click", () => {
      currentStandingsTab = tab.id;
      document.querySelectorAll(".standings-tab").forEach(b => b.classList.toggle("active", b.dataset.tid === tab.id));
      document.querySelectorAll(".standings-panel").forEach(p => {
        p.style.display = p.dataset.tid === tab.id ? "block" : "none";
      });
    });
    tabsEl.appendChild(btn);

    const panel = document.createElement("div");
    panel.className = "standings-panel";
    panel.dataset.tid = tab.id;
    panel.style.display = tab.id === currentStandingsTab ? "block" : "none";
    const tableId = "standings-table-" + tab.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    panel.innerHTML = standingsTableHTML(tableId);
    panelsEl.appendChild(panel);
    fillStandingsTbody(panel.querySelector("tbody"), standingsByTournament[tab.id] || []);
    bindSortHeaders(panel.querySelector("table"), tab.id);
  });
}

/** Совместимость со старым вызовом renderStandings(rows) */
function renderStandings(standings) {
  const tbody = document.querySelector("#standings-table tbody");
  if (tbody) fillStandingsTbody(tbody, standings);
}

function bindSortHeaders(table, tournamentKey) {
  if (!table) return;
  const headers = table.querySelectorAll("th.sortable");
  let sort = { key: "points", dir: "desc" };
  headers.forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (!key) return;
      if (sort.key === key) sort.dir = sort.dir === "asc" ? "desc" : "asc";
      else {
        sort.key = key;
        sort.dir = key === "name" ? "asc" : "desc";
      }
      headers.forEach(h => h.classList.remove("sort-asc", "sort-desc"));
      th.classList.add(sort.dir === "asc" ? "sort-asc" : "sort-desc");
      const base = standingsByTournament[tournamentKey] || [];
      const sorted = [...base].sort((a, b) => {
        if (key === "gd") {
          const va = a.gf - a.ga, vb = b.gf - b.ga;
          return sort.dir === "asc" ? va - vb : vb - va;
        }
        if (key === "name") {
          return sort.dir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }
        const va = a[key], vb = b[key];
        return sort.dir === "asc" ? va - vb : vb - va;
      });
      fillStandingsTbody(table.querySelector("tbody"), sorted);
    });
  });
}

function initTableSorting() {
  // сортировка вешается при renderStandingsByTournaments
}
