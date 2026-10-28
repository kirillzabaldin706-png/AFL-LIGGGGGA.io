/**
 * Картинка-пост матча: несколько фонов на выбор.
 */
const STAGE_LABELS = {
  regular: "Матч",
  group: "Групповой этап",
  r16: "1/8 финала",
  qf: "1/4 финала",
  sf: "1/2 финала",
  final: "ФИНАЛ",
  third: "Матч за 3-е место"
};

const POSTER_BACKGROUNDS = {
  night: {
    name: "Ночной стадион",
    stops: [["#0a1628", 0], ["#1e3a5f", 0.45], ["#0c4a6e", 1]],
    accent: "#38bdf8",
    glow: "rgba(56,189,248,0.15)"
  },
  emerald: {
    name: "Изумруд",
    stops: [["#022c22", 0], ["#065f46", 0.5], ["#0f766e", 1]],
    accent: "#34d399",
    glow: "rgba(52,211,153,0.18)"
  },
  sunset: {
    name: "Закат",
    stops: [["#1c1917", 0], ["#9a3412", 0.4], ["#b45309", 0.7], ["#1e1b4b", 1]],
    accent: "#fbbf24",
    glow: "rgba(251,191,36,0.2)"
  },
  purple: {
    name: "Неон",
    stops: [["#1e1b4b", 0], ["#4c1d95", 0.5], ["#831843", 1]],
    accent: "#e879f9",
    glow: "rgba(232,121,249,0.18)"
  },
  carbon: {
    name: "Карбон",
    stops: [["#18181b", 0], ["#27272a", 0.5], ["#3f3f46", 1]],
    accent: "#a1a1aa",
    glow: "rgba(255,255,255,0.08)"
  },
  pitch: {
    name: "Газон",
    stops: [["#14532d", 0], ["#166534", 0.35], ["#15803d", 0.65], ["#052e16", 1]],
    accent: "#86efac",
    glow: "rgba(134,239,172,0.15)"
  }
};

function loadImageSafe(url) {
  return new Promise(resolve => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawPosterBackground(ctx, W, H, themeKey) {
  const theme = POSTER_BACKGROUNDS[themeKey] || POSTER_BACKGROUNDS.night;
  const g = ctx.createLinearGradient(0, 0, W, H);
  theme.stops.forEach(([c, p]) => g.addColorStop(p, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // диагональные полосы
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#fff";
  for (let i = -H; i < W + H; i += 48) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 24, 0);
    ctx.lineTo(i + 24 + H, H);
    ctx.lineTo(i + H, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // свечения
  ctx.fillStyle = theme.glow;
  ctx.beginPath();
  ctx.arc(W * 0.85, 140, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(100, H - 80, 220, 0, Math.PI * 2);
  ctx.fill();

  // «газон» внизу
  const grass = ctx.createLinearGradient(0, H - 180, 0, H);
  grass.addColorStop(0, "rgba(0,0,0,0)");
  grass.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = grass;
  ctx.fillRect(0, H - 180, W, 180);

  return theme;
}

async function generateMatchPoster(m, home, away, opts = {}) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const theme = drawPosterBackground(ctx, W, H, opts.theme || "night");

  ctx.fillStyle = "#fff";
  ctx.font = "bold 42px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(opts.leagueName || "АФЛ", W / 2, 90);

  const stage = STAGE_LABELS[m.stage] || STAGE_LABELS.regular;
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillStyle = theme.accent;
  ctx.fillText(stage, W / 2, 140);

  const dateStr = m.date
    ? new Date(m.date).toLocaleDateString("ru-RU", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
    : "";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillText(dateStr, W / 2, 185);

  const homeLogo = await loadImageSafe(home?.logo);
  const awayLogo = await loadImageSafe(away?.logo);

  const drawLogo = (img, x, y, size) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    if (img) ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    else {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 48px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FC", x, y);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.stroke();
  };

  const logoY = 360;
  drawLogo(homeLogo, 280, logoY, 200);
  drawLogo(awayLogo, W - 280, logoY, 200);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.textAlign = "center";
  const homeName = (home?.name || "Хозяева").toUpperCase();
  const awayName = (away?.name || "Гости").toUpperCase();
  ctx.fillText(homeName.length > 16 ? homeName.slice(0, 15) + "…" : homeName, 280, 520);
  ctx.fillText(awayName.length > 16 ? awayName.slice(0, 15) + "…" : awayName, W - 280, 520);

  const isFinished = m.status === "finished";
  ctx.fillStyle = theme.accent;
  ctx.font = "bold 120px system-ui, sans-serif";
  ctx.fillText(isFinished ? `${m.homeScore ?? 0} : ${m.awayScore ?? 0}` : "VS", W / 2, 400);

  ctx.fillStyle = isFinished ? "#4ade80" : "#fbbf24";
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.fillText(isFinished ? "ЗАВЕРШЁН" : "СКОРО", W / 2, 580);

  let y = 660;
  if (m.scorers) {
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillText("ГОЛЫ", W / 2, y);
    y += 40;
    ctx.font = "26px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    wrapText(ctx, String(m.scorers), W - 120).slice(0, 6).forEach(line => {
      ctx.fillText(line, W / 2, y);
      y += 34;
    });
    y += 16;
  }

  const stats = [
    ["Владение %", m.homePossession, m.awayPossession],
    ["Удары", m.homeShots, m.awayShots],
    ["Угловые", m.homeCorners, m.awayCorners],
    ["Жёлтые", m.homeYellow, m.awayYellow],
    ["Красные", m.homeRed, m.awayRed]
  ].filter(s => s[1] != null || s[2] != null);

  if (stats.length) {
    y = Math.max(y, 780);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillText("СТАТИСТИКА", W / 2, y);
    y += 50;
    stats.forEach(([lbl, h, a]) => {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 32px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(String(h ?? "—"), W / 2 - 160, y);
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "24px system-ui, sans-serif";
      ctx.fillText(lbl, W / 2, y);
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 32px system-ui, sans-serif";
      ctx.fillText(String(a ?? "—"), W / 2 + 160, y);
      y += 48;
    });
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText("АФЛ · любительская футбольная лига", W / 2, H - 50);

  return canvas;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach(w => {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

async function downloadMatchPoster(m, home, away, theme) {
  try {
    const canvas = await generateMatchPoster(m, home, away, { theme: theme || "night" });
    const a = document.createElement("a");
    a.download = `afl-${(home?.name || "home")}-${(away?.name || "away")}.png`.replace(/\s+/g, "_");
    a.href = canvas.toDataURL("image/png");
    a.click();
    if (typeof showToast === "function") showToast("Картинка сохранена");
  } catch (e) {
    console.error(e);
    if (typeof showToast === "function") showToast("Не удалось создать картинку", true);
  }
}

function openPosterThemePicker(m, home, away) {
  let box = document.getElementById("posterThemePicker");
  if (!box) {
    box = document.createElement("div");
    box.id = "posterThemePicker";
    box.className = "poster-theme-picker";
    document.body.appendChild(box);
  }
  const themes = Object.entries(POSTER_BACKGROUNDS);
  box.innerHTML = `
    <div class="ptp-card">
      <h3>Фон для поста</h3>
      <div class="ptp-grid">
        ${themes.map(([k, t]) => `
          <button type="button" class="ptp-item" data-theme="${k}">
            <span class="ptp-swatch" style="background:linear-gradient(135deg,${t.stops.map(s => s[0]).join(",")})"></span>
            <span>${t.name}</span>
          </button>`).join("")}
      </div>
      <button type="button" class="btn-reset ptp-close">Отмена</button>
    </div>`;
  box.classList.add("open");
  box.querySelector(".ptp-close").onclick = () => box.classList.remove("open");
  box.querySelectorAll(".ptp-item").forEach(btn => {
    btn.onclick = () => {
      box.classList.remove("open");
      downloadMatchPoster(m, home, away, btn.dataset.theme);
    };
  });
}

/** Скачать турнирную таблицу как PNG */
async function downloadStandingsPoster(rows, title) {
  const W = 1080;
  const rowH = 56;
  const headerH = 160;
  const H = headerH + 50 + (rows.length + 1) * rowH + 60;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.max(H, 600);
  const ctx = canvas.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, W, canvas.height);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(1, "#1e3a5f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, canvas.height);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("АФЛ", W / 2, 55);
  ctx.font = "bold 32px system-ui, sans-serif";
  ctx.fillStyle = "#7dd3fc";
  ctx.fillText(title || "Турнирная таблица", W / 2, 105);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText(new Date().toLocaleDateString("ru-RU"), W / 2, 140);

  const cols = [
    { k: "#", x: 50, w: 50 },
    { k: "Команда", x: 110, w: 380 },
    { k: "И", x: 520, w: 60 },
    { k: "В", x: 590, w: 60 },
    { k: "Н", x: 660, w: 60 },
    { k: "П", x: 730, w: 60 },
    { k: "М", x: 820, w: 100 },
    { k: "О", x: 960, w: 70 }
  ];
  let y = headerH;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(30, y, W - 60, rowH);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "left";
  cols.forEach(c => ctx.fillText(c.k, c.x, y + 36));
  y += rowH;

  rows.forEach((r, i) => {
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(30, y, W - 60, rowH);
    }
    ctx.fillStyle = i < 3 ? "#fbbf24" : "#fff";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillText(String(i + 1), cols[0].x, y + 36);
    ctx.fillStyle = "#fff";
    ctx.font = "24px system-ui, sans-serif";
    const name = (r.name || "").length > 22 ? (r.name || "").slice(0, 21) + "…" : (r.name || "");
    ctx.fillText(name, cols[1].x, y + 36);
    ctx.textAlign = "center";
    [r.played, r.win, r.draw, r.lose].forEach((v, j) => {
      ctx.fillText(String(v ?? 0), cols[2 + j].x + 25, y + 36);
    });
    ctx.fillText(`${r.gf ?? 0}:${r.ga ?? 0}`, cols[6].x + 40, y + 36);
    ctx.fillStyle = "#4ade80";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillText(String(r.points ?? 0), cols[7].x + 30, y + 36);
    ctx.textAlign = "left";
    y += rowH;
  });

  const a = document.createElement("a");
  a.download = "afl-table.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
  if (typeof showToast === "function") showToast("Таблица сохранена");
}

window.downloadMatchPoster = downloadMatchPoster;
window.generateMatchPoster = generateMatchPoster;
window.openPosterThemePicker = openPosterThemePicker;
window.downloadStandingsPoster = downloadStandingsPoster;
window.STAGE_LABELS = STAGE_LABELS;
window.POSTER_BACKGROUNDS = POSTER_BACKGROUNDS;
