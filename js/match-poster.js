/**
 * Генерация картинки-поста по протоколу матча (для Telegram / Stories).
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

async function generateMatchPoster(m, home, away, opts = {}) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Фон
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(0.5, "#1e3a5f");
  g.addColorStop(1, "#0c4a6e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Декор
  ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
  ctx.beginPath();
  ctx.arc(W * 0.85, 120, 280, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(80, H - 100, 200, 0, Math.PI * 2);
  ctx.fill();

  // Шапка
  ctx.fillStyle = "#fff";
  ctx.font = "bold 42px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(opts.leagueName || "АФЛ", W / 2, 90);

  const stage = STAGE_LABELS[m.stage] || STAGE_LABELS.regular;
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillStyle = "#7dd3fc";
  ctx.fillText(stage, W / 2, 140);

  const dateStr = m.date
    ? new Date(m.date).toLocaleDateString("ru-RU", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
    : "";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
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
    if (img) {
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    } else {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 48px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FC", x, y);
    }
    ctx.restore();
    // кольцо
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.stroke();
  };

  const logoY = 360;
  drawLogo(homeLogo, 280, logoY, 200);
  drawLogo(awayLogo, W - 280, logoY, 200);

  // Имена
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.textAlign = "center";
  const homeName = (home?.name || "Хозяева").toUpperCase();
  const awayName = (away?.name || "Гости").toUpperCase();
  ctx.fillText(homeName.length > 16 ? homeName.slice(0, 15) + "…" : homeName, 280, 520);
  ctx.fillText(awayName.length > 16 ? awayName.slice(0, 15) + "…" : awayName, W - 280, 520);

  // Счёт
  const isFinished = m.status === "finished";
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 120px system-ui, sans-serif";
  const scoreText = isFinished
    ? `${m.homeScore ?? 0} : ${m.awayScore ?? 0}`
    : "VS";
  ctx.fillText(scoreText, W / 2, 400);

  if (isFinished) {
    ctx.fillStyle = "#4ade80";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillText("ЗАВЕРШЁН", W / 2, 580);
  } else {
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillText("СКОРО", W / 2, 580);
  }

  // Голы
  let y = 660;
  if (m.scorers) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillText("ГОЛЫ", W / 2, y);
    y += 40;
    ctx.font = "26px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    const lines = wrapText(ctx, String(m.scorers), W - 120);
    lines.slice(0, 6).forEach(line => {
      ctx.fillText(line, W / 2, y);
      y += 34;
    });
    y += 20;
  }

  // Статистика
  const stats = [
    ["Владение %", m.homePossession, m.awayPossession],
    ["Удары", m.homeShots, m.awayShots],
    ["Угловые", m.homeCorners, m.awayCorners],
    ["Жёлтые", m.homeYellow, m.awayYellow],
    ["Красные", m.homeRed, m.awayRed]
  ].filter(s => s[1] != null || s[2] != null);

  if (stats.length) {
    y = Math.max(y, 780);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
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

  // Подвал
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

async function downloadMatchPoster(m, home, away) {
  try {
    const canvas = await generateMatchPoster(m, home, away);
    const a = document.createElement("a");
    a.download = `afl-${(home?.name || "home")}-${(away?.name || "away")}.png`.replace(/\s+/g, "_");
    a.href = canvas.toDataURL("image/png");
    a.click();
    if (typeof showToast === "function") showToast("Картинка для поста сохранена");
  } catch (e) {
    console.error(e);
    if (typeof showToast === "function") showToast("Не удалось создать картинку", true);
    else alert("Не удалось создать картинку");
  }
}

window.downloadMatchPoster = downloadMatchPoster;
window.generateMatchPoster = generateMatchPoster;
window.STAGE_LABELS = STAGE_LABELS;
