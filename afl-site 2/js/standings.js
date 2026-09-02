function calculateStandings(matches, teams) {
  const table = {};
  teams.forEach(t => {
    table[t.id] = {
      id: t.id, name: t.name, logo: t.logo || "",
      played: 0, win: 0, draw: 0, lose: 0, gf: 0, ga: 0, points: 0, form: []
    };
  });

  const sortedMatches = [...matches]
    .filter(m => m.status === "finished")
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedMatches.forEach(m => {
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

  return Object.values(table).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });
}

let currentStandings = [];
let currentSort = { key: "points", dir: "desc" };

function renderStandings(standings) {
  currentStandings = standings;
  const tbody = document.querySelector("#standings-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  standings.forEach((t, i) => {
    const pos = i + 1;
    const posClass = pos === 1 ? "pos-1" : pos === 2 ? "pos-2" : pos === 3 ? "pos-3" : "";
    const gd = t.gf - t.ga;
    const gdStr = gd > 0 ? `+${gd}` : gd;
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

function initTableSorting() {
  const headers = document.querySelectorAll("#standings-table th.sortable");
  headers.forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (!key) return;
      if (currentSort.key === key) {
        currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
      } else {
        currentSort.key = key;
        currentSort.dir = key === "name" ? "asc" : "desc";
      }
      headers.forEach(h => h.classList.remove("sort-asc", "sort-desc"));
      th.classList.add(currentSort.dir === "asc" ? "sort-asc" : "sort-desc");
      const sorted = [...currentStandings].sort((a, b) => {
        let va, vb;
        if (key === "gd") { va = a.gf - a.ga; vb = b.gf - b.ga; }
        else if (key === "name") {
          return currentSort.dir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        } else { va = a[key]; vb = b[key]; }
        return currentSort.dir === "asc" ? va - vb : vb - va;
      });
      renderStandings(sorted);
    });
  });
}
