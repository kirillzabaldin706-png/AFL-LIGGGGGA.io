// ============================================
// USER SYSTEM: регистрация, звёзды, ставки, магазин
// ============================================

const REG_BONUS = 1000;
const DEFAULT_ODDS = {
  home: 2.0, draw: 2.8, away: 2.2,
  dc_1x: 1.35, dc_x2: 1.4, dc_12: 1.3,
  over05: 1.15, under05: 5.5,
  over15: 1.35, under15: 3.2,
  over25: 1.9, under25: 1.9,
  over35: 2.6, under35: 1.45,
  btts_yes: 2.1, btts_no: 1.7,
  ah_home_m1: 3.4, ah_away_p1: 1.35,
  ah_away_m1: 3.6, ah_home_p1: 1.32,
  home_win_nil: 4.5, away_win_nil: 5.0,
  scorer: 3.5,
  fg_home: 1.9, fg_away: 2.1, fg_none: 8.0
};

const BET_THEMES = [
  { id: "night", name: "Ночь", css: "linear-gradient(145deg,#0f172a 0%,#1e3a5f 50%,#0c4a6e 100%)" },
  { id: "emerald", name: "Изумруд", css: "linear-gradient(145deg,#022c22 0%,#065f46 50%,#0f766e 100%)" },
  { id: "sunset", name: "Закат", css: "linear-gradient(145deg,#1c1917 0%,#9a3412 45%,#1e1b4b 100%)" },
  { id: "purple", name: "Неон", css: "linear-gradient(145deg,#1e1b4b 0%,#4c1d95 50%,#831843 100%)" },
  { id: "pitch", name: "Газон", css: "linear-gradient(145deg,#14532d 0%,#166534 40%,#052e16 100%)" },
  { id: "carbon", name: "Карбон", css: "linear-gradient(145deg,#18181b 0%,#27272a 50%,#3f3f46 100%)" }
];

function oddsOf(pick) {
  if (String(pick).startsWith("scorer:")) return DEFAULT_ODDS.scorer;
  if (String(pick).startsWith("score:")) return 8.5;
  return DEFAULT_ODDS[pick] || 2;
}

function pickLabel(pick, match) {
  const home = globalTeamsForBets.find(t => t.id === match?.homeId)?.name || "П1";
  const away = globalTeamsForBets.find(t => t.id === match?.awayId)?.name || "П2";
  const map = {
    home: "П1 · " + home, draw: "Ничья", away: "П2 · " + away,
    dc_1x: "1X", dc_x2: "X2", dc_12: "12",
    over05: "ТБ 0.5", under05: "ТМ 0.5",
    over15: "ТБ 1.5", under15: "ТМ 1.5",
    over25: "ТБ 2.5", under25: "ТМ 2.5",
    over35: "ТБ 3.5", under35: "ТМ 3.5",
    btts_yes: "Обе забьют — да", btts_no: "Обе забьют — нет",
    ah_home_m1: "Фора 1 (−1)", ah_away_p1: "Фора 2 (+1)",
    ah_away_m1: "Фора 2 (−1)", ah_home_p1: "Фора 1 (+1)",
    home_win_nil: "П1 всухую", away_win_nil: "П2 всухую",
    fg_home: "Первый гол — хозяева", fg_away: "Первый гол — гости", fg_none: "Без голов"
  };
  if (String(pick).startsWith("scorer:")) {
    const pl = (window.globalPlayers || []).find(p => p.id === pick.slice(7));
    return "Гол: " + (pl?.name || "игрок");
  }
  if (String(pick).startsWith("score:")) return "Счёт " + pick.slice(6).replace("-", ":");
  return map[pick] || pick;
}


let currentUser = null;
let userProfile = null; // { stars, displayName, email }
let globalShop = [];
let globalBets = [];
let globalMatchesForBets = [];
let globalTeamsForBets = [];

function initUserSystem() {
  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
      await ensureUserProfile(user);
      await loadUserProfile(user.uid);
      updateUserUI();
      settleOpenBets(); // попытка рассчитать открытые ставки
    } else {
      userProfile = null;
      updateUserUI();
    }
  });

  document.getElementById("userLoginBtn")?.addEventListener("click", () => openAuthModal("login"));
  document.getElementById("userRegisterBtn")?.addEventListener("click", () => openAuthModal("register"));
  document.getElementById("userLogoutBtn")?.addEventListener("click", async () => {
    await auth.signOut();
    showToast("Вы вышли");
  });

  document.getElementById("authForm")?.addEventListener("submit", handleAuthSubmit);
  document.getElementById("authSwitchBtn")?.addEventListener("click", () => {
    const mode = document.getElementById("authMode").value;
    openAuthModal(mode === "login" ? "register" : "login");
  });

  document.getElementById("siteSearch")?.addEventListener("input", onSiteSearch);
  document.getElementById("siteSearchClear")?.addEventListener("click", () => {
    const inp = document.getElementById("siteSearch");
    if (inp) { inp.value = ""; onSiteSearch({ target: inp }); }
  });
}

async function ensureUserProfile(user) {
  const ref = db.ref("users/" + user.uid);
  const snap = await ref.once("value");
  if (!snap.exists()) {
    await ref.set({
      email: user.email || "",
      displayName: user.displayName || (user.email || "").split("@")[0],
      stars: REG_BONUS,
      createdAt: new Date().toISOString(),
      bonusGiven: true
    });
    showToast("Добро пожаловать! Начислено " + REG_BONUS + " ⭐");
  } else {
    const data = snap.val() || {};
    // Если профиль есть, но бонус не выдан — выдать один раз
    if (!data.bonusGiven && (data.stars == null || data.stars === 0)) {
      await ref.update({ stars: REG_BONUS, bonusGiven: true });
      showToast("Бонус за регистрацию: +" + REG_BONUS + " ⭐");
    }
  }
}

async function loadUserProfile(uid) {
  const snap = await db.ref("users/" + uid).once("value");
  userProfile = snap.val() || { stars: 0 };
  userProfile.uid = uid;
}

function updateUserUI() {
  const guest = document.getElementById("userGuestBar");
  const logged = document.getElementById("userLoggedBar");
  const starsEl = document.getElementById("userStars");
  const nameEl = document.getElementById("userName");
  if (!guest || !logged) return;

  if (currentUser && userProfile) {
    guest.style.display = "none";
    logged.style.display = "flex";
    if (starsEl) starsEl.textContent = userProfile.stars ?? 0;
    if (nameEl) nameEl.textContent = userProfile.displayName || currentUser.email || "Игрок";
  } else {
    guest.style.display = "flex";
    logged.style.display = "none";
  }
  renderBetMatches();
  renderShop();
  renderMyBets();
}

function openAuthModal(mode) {
  const overlay = document.getElementById("authModal");
  if (!overlay) return;
  document.getElementById("authMode").value = mode;
  document.getElementById("authTitle").textContent = mode === "login" ? "Вход" : "Регистрация";
  document.getElementById("authSubmitBtn").textContent = mode === "login" ? "Войти" : "Зарегистрироваться";
  document.getElementById("authSwitchBtn").textContent =
    mode === "login" ? "Нет аккаунта? Регистрация" : "Уже есть аккаунт? Войти";
  document.getElementById("authNameGroup").style.display = mode === "register" ? "block" : "none";
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const mode = document.getElementById("authMode").value;
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const name = document.getElementById("authName")?.value.trim() || "";

  try {
    if (mode === "register") {
      if (password.length < 6) return showToast("Пароль минимум 6 символов", true);
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      if (name) {
        try { await cred.user.updateProfile({ displayName: name }); } catch (_) {}
      }
      // Профиль + 1000 звёзд (бонус)
      await db.ref("users/" + cred.user.uid).set({
        email,
        displayName: name || email.split("@")[0],
        stars: REG_BONUS,
        createdAt: new Date().toISOString(),
        bonusGiven: true
      });
      userProfile = {
        uid: cred.user.uid,
        email,
        displayName: name || email.split("@")[0],
        stars: REG_BONUS,
        bonusGiven: true
      };
      showToast("Регистрация успешна! +" + REG_BONUS + " ⭐");
    } else {
      await auth.signInWithEmailAndPassword(email, password);
      showToast("Вход выполнен");
    }
    document.getElementById("authModal")?.classList.remove("active");
    document.body.style.overflow = "";
    document.getElementById("authForm")?.reset();
  } catch (err) {
    const msg = (err.message || "").includes("email-already")
      ? "Этот email уже зарегистрирован"
      : (err.message || "").includes("wrong-password") || (err.message || "").includes("invalid-credential")
        ? "Неверный email или пароль"
        : err.message;
    showToast(msg, true);
  }
}

// ========== СТАВКИ ==========
function setBetContext(matches, teams) {
  globalMatchesForBets = matches || [];
  globalTeamsForBets = teams || [];
  renderBetMatches();
  if (currentUser) settleOpenBets();
}

function renderBetMatches() {
  const el = document.getElementById("bets-list");
  if (!el) return;

  const upcoming = globalMatchesForBets
    .filter(m => m.status !== "finished")
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  if (!upcoming.length) {
    el.innerHTML = "<p class='empty-hint'>Нет матчей для ставок. Добавьте матчи со статусом «Скоро».</p>";
    return;
  }

  el.innerHTML = upcoming.map(m => {
    const homeT = globalTeamsForBets.find(t => t.id === m.homeId);
    const awayT = globalTeamsForBets.find(t => t.id === m.awayId);
    const home = homeT?.name || "Хозяева";
    const away = awayT?.name || "Гости";
    const dateStr = m.date
      ? new Date(m.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : "";
    const logo = (t) => t?.logo || "https://via.placeholder.com/40?text=FC";
    return `
      <div class="bet-card bet-card-compact" data-match-id="${m.id}" role="button" tabindex="0">
        <div class="bet-compact-top">
          <span class="bet-date">${dateStr}</span>
          <span class="bet-open-hint">Все рынки →</span>
        </div>
        <div class="bet-compact-teams">
          <div class="bet-compact-team"><img src="${logo(homeT)}" alt="" onerror="this.src='https://via.placeholder.com/40?text=FC'"><span>${home}</span></div>
          <div class="bet-compact-vs">vs</div>
          <div class="bet-compact-team"><img src="${logo(awayT)}" alt="" onerror="this.src='https://via.placeholder.com/40?text=FC'"><span>${away}</span></div>
        </div>
        <div class="bet-odds bet-odds-preview">
          <span class="bet-chip">П1 ${DEFAULT_ODDS.home}</span>
          <span class="bet-chip">X ${DEFAULT_ODDS.draw}</span>
          <span class="bet-chip">П2 ${DEFAULT_ODDS.away}</span>
        </div>
      </div>`;
  }).join("");

  el.querySelectorAll(".bet-card-compact").forEach(card => {
    card.addEventListener("click", () => openFullBetSlip(card.dataset.matchId));
  });
}

function openFullBetSlip(matchId) {
  const m = globalMatchesForBets.find(x => x.id === matchId);
  if (!m) return;
  const homeT = globalTeamsForBets.find(t => t.id === m.homeId);
  const awayT = globalTeamsForBets.find(t => t.id === m.awayId);
  const home = homeT?.name || "Хозяева";
  const away = awayT?.name || "Гости";
  const dateStr = m.date
    ? new Date(m.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";
  const players = (window.globalPlayers || []).filter(p => p.teamId === m.homeId || p.teamId === m.awayId);
  const logo = (t) => t?.logo || "https://via.placeholder.com/56?text=FC";

  const mk = (pick, label) => {
    const o = oddsOf(pick);
    return `<button type="button" class="bm-pick" data-pick="${pick}" data-odds="${o}"><span class="bm-lbl">${label}</span><span class="bm-odd">${o}</span></button>`;
  };

  let ov = document.getElementById("betSlipModal");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "betSlipModal";
    ov.className = "modal-overlay bet-slip-overlay";
    document.body.appendChild(ov);
  }

  const themeBtns = BET_THEMES.map(t =>
    `<button type="button" class="bet-theme-btn" data-theme="${t.id}" style="background:${t.css}" title="${t.name}"></button>`
  ).join("");

  const scores = ["1-0","2-0","2-1","0-0","1-1","2-2","0-1","0-2","1-2","3-1","1-3","3-0","0-3"];
  const scoreBtns = scores.map(s => mk("score:" + s, s.replace("-", ":"))).join("");

  const scorerBtns = players.slice(0, 12).map(p =>
    mk("scorer:" + p.id, (p.name || "?").split(" ").slice(-1)[0])
  ).join("");

  ov.innerHTML = `
    <div class="modal bet-slip-modal" id="betSlipInner">
      <button type="button" class="modal-close" id="betSlipClose">×</button>
      <div class="bet-slip-themes">${themeBtns}</div>
      <div class="bet-slip-head">
        <div class="bet-slip-teams">
          <div><img src="${logo(homeT)}" alt=""><strong>${home}</strong></div>
          <span>vs</span>
          <div><img src="${logo(awayT)}" alt=""><strong>${away}</strong></div>
        </div>
        <div class="bet-slip-date">${dateStr}</div>
        <p class="bet-slip-note">Только звёзды ⭐ · не деньги</p>
      </div>
      <div class="bet-slip-body">
        <div class="bm-block"><h4>Исход матча</h4><div class="bm-grid">${mk("home","П1")}${mk("draw","X")}${mk("away","П2")}</div></div>
        <div class="bm-block"><h4>Двойной шанс</h4><div class="bm-grid">${mk("dc_1x","1X")}${mk("dc_x2","X2")}${mk("dc_12","12")}</div></div>
        <div class="bm-block"><h4>Тотал голов</h4><div class="bm-grid bm-grid-4">
          ${mk("over05","ТБ 0.5")}${mk("under05","ТМ 0.5")}
          ${mk("over15","ТБ 1.5")}${mk("under15","ТМ 1.5")}
          ${mk("over25","ТБ 2.5")}${mk("under25","ТМ 2.5")}
          ${mk("over35","ТБ 3.5")}${mk("under35","ТМ 3.5")}
        </div></div>
        <div class="bm-block"><h4>Обе забьют</h4><div class="bm-grid">${mk("btts_yes","Да")}${mk("btts_no","Нет")}</div></div>
        <div class="bm-block"><h4>Фора</h4><div class="bm-grid">
          ${mk("ah_home_m1","1 (−1)")}${mk("ah_home_p1","1 (+1)")}
          ${mk("ah_away_m1","2 (−1)")}${mk("ah_away_p1","2 (+1)")}
        </div></div>
        <div class="bm-block"><h4>Победа всухую</h4><div class="bm-grid">${mk("home_win_nil","П1 0")}${mk("away_win_nil","П2 0")}</div></div>
        <div class="bm-block"><h4>Точный счёт</h4><div class="bm-grid bm-grid-scores">${scoreBtns}</div></div>
        <div class="bm-block"><h4>Первый гол</h4><div class="bm-grid">${mk("fg_home","Хозяева")}${mk("fg_away","Гости")}${mk("fg_none","Не будет")}</div></div>
        ${scorerBtns ? `<div class="bm-block"><h4>Кто забьёт (любой гол)</h4><div class="bm-grid bm-grid-scores">${scorerBtns}</div></div>` : ""}
      </div>
      <div class="bet-slip-footer">
        <div class="bet-slip-selected" id="betSlipSelected">Выберите исход</div>
        <div class="bet-slip-row">
          <input type="number" min="10" step="10" value="50" id="betSlipAmount" placeholder="Сумма ⭐">
          <button type="button" class="btn-save" id="betSlipPlace">Поставить</button>
        </div>
        <div class="bet-slip-potential" id="betSlipPotential"></div>
      </div>
    </div>`;

  ov.classList.add("active");
  document.body.style.overflow = "hidden";
  // default theme
  applyBetTheme("night");

  document.getElementById("betSlipClose").onclick = closeBetSlip;
  ov.onclick = e => { if (e.target === ov) closeBetSlip(); };

  let selectedPick = null;
  const updateSel = () => {
    const amt = Math.floor(Number(document.getElementById("betSlipAmount")?.value) || 0);
    const box = document.getElementById("betSlipSelected");
    const pot = document.getElementById("betSlipPotential");
    if (!selectedPick) {
      box.textContent = "Выберите исход";
      pot.textContent = "";
      return;
    }
    const o = oddsOf(selectedPick);
    box.innerHTML = `<strong>${pickLabel(selectedPick, m)}</strong> · кэф <b>${o}</b>`;
    if (amt >= 10) pot.textContent = "Возможный выигрыш: " + Math.floor(amt * o) + " ⭐";
    else pot.textContent = "";
  };

  ov.querySelectorAll(".bm-pick").forEach(btn => {
    btn.addEventListener("click", () => {
      ov.querySelectorAll(".bm-pick").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedPick = btn.dataset.pick;
      updateSel();
    });
  });
  document.getElementById("betSlipAmount")?.addEventListener("input", updateSel);
  document.getElementById("betSlipPlace")?.addEventListener("click", async () => {
    if (!selectedPick) return showToast("Выберите исход", true);
    const amount = Math.floor(Number(document.getElementById("betSlipAmount")?.value) || 0);
    await placeBetDirect(matchId, selectedPick, amount);
  });
  ov.querySelectorAll(".bet-theme-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      applyBetTheme(btn.dataset.theme);
    });
  });
}

function applyBetTheme(id) {
  const t = BET_THEMES.find(x => x.id === id) || BET_THEMES[0];
  const inner = document.getElementById("betSlipInner");
  if (inner) {
    inner.style.background = t.css;
    inner.dataset.theme = t.id;
  }
  document.querySelectorAll(".bet-theme-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.theme === t.id);
  });
}

function closeBetSlip() {
  const ov = document.getElementById("betSlipModal");
  if (ov) ov.classList.remove("active");
  document.body.style.overflow = "";
}

async function placeBetDirect(matchId, pick, amount) {
  if (!currentUser || !userProfile) {
    showToast("Войдите, чтобы ставить", true);
    openAuthModal("login");
    return;
  }
  if (!pick) return showToast("Выберите исход ставки", true);
  amount = Math.floor(Number(amount) || 0);
  if (amount < 10) return showToast("Минимальная ставка 10 ⭐", true);
  if (amount > (userProfile.stars || 0)) return showToast("Недостаточно звёзд", true);

  const odds = oddsOf(pick);
  const newStars = (userProfile.stars || 0) - amount;
  try {
    await db.ref("users/" + currentUser.uid).update({ stars: newStars });
    await db.ref("bets").push({
      userId: currentUser.uid,
      matchId,
      pick,
      amount,
      odds,
      status: "open",
      createdAt: new Date().toISOString()
    });
    userProfile.stars = newStars;
    updateUserUI();
    showToast("Ставка принята: " + amount + " ⭐ · кэф " + odds);
    closeBetSlip();
    if (typeof renderMyBets === "function") renderMyBets();
  } catch (err) {
    showToast("Ошибка ставки: " + err.message, true);
  }
}

async function placeBet(matchId) {
  // совместимость: открыть полный купон
  openFullBetSlip(matchId);
}

async function settleOpenBets() {
  if (!currentUser) return;
  try {
    // Без orderBy — работает без .indexOn в Rules
    const [betsSnap, matchesSnap, profileSnap] = await Promise.all([
      db.ref("bets").once("value"),
      db.ref("matches").once("value"),
      db.ref("users/" + currentUser.uid).once("value")
    ]);
    const matches = matchesSnap.val() || {};
    const allBets = betsSnap.val() || {};
    const profile = profileSnap.val() || {};
    let currentStars = Number(profile.stars) || 0;
    if (userProfile) userProfile.stars = currentStars;

    let starsDelta = 0;
    const settledIds = [];

    for (const [id, bet] of Object.entries(allBets)) {
      if (!bet || bet.userId !== currentUser.uid) continue;
      if (bet.status !== "open") continue;
      const m = matches[bet.matchId];
      if (!m || m.status !== "finished") continue;

      const hs = Number(m.homeScore ?? m.homeGoals ?? 0) || 0;
      const as = Number(m.awayScore ?? m.awayGoals ?? 0) || 0;
      let result = "draw";
      if (hs > as) result = "home";
      else if (hs < as) result = "away";
      const total = hs + as;
      const scorersText = String(m.scorers || "").toLowerCase();

      const pick = String(bet.pick || "");
      const pickL = pick.toLowerCase();
      let won = false;
      if (pickL === result) won = true;
      else if (pickL === "dc_1x") won = result === "home" || result === "draw";
      else if (pickL === "dc_x2") won = result === "away" || result === "draw";
      else if (pickL === "dc_12") won = result === "home" || result === "away";
      else if (pickL === "over05") won = total > 0.5;
      else if (pickL === "under05") won = total < 0.5;
      else if (pickL === "over15") won = total > 1.5;
      else if (pickL === "under15") won = total < 1.5;
      else if (pickL === "over25") won = total > 2.5;
      else if (pickL === "under25") won = total < 2.5;
      else if (pickL === "over35") won = total > 3.5;
      else if (pickL === "under35") won = total < 3.5;
      else if (pickL === "btts_yes") won = hs > 0 && as > 0;
      else if (pickL === "btts_no") won = hs === 0 || as === 0;
      else if (pickL === "ah_home_m1") won = (hs - as) > 1;
      else if (pickL === "ah_home_p1") won = (hs - as) > -1;
      else if (pickL === "ah_away_m1") won = (as - hs) > 1;
      else if (pickL === "ah_away_p1") won = (as - hs) > -1;
      else if (pickL === "home_win_nil") won = hs > as && as === 0;
      else if (pickL === "away_win_nil") won = as > hs && hs === 0;
      else if (pickL === "fg_none") won = total === 0;
      else if (pickL === "fg_home" || pickL === "fg_away") {
        // без минуты первого гола — не авто: админ/пропуск; считаем проигрыш если нет данных
        won = false;
      }
      else if (pickL.startsWith("score:")) {
        const exp = pick.slice(6).replace(":", "-");
        won = exp === (hs + "-" + as);
      }
      else if (pickL.startsWith("scorer:")) {
        const pid = pick.slice(7);
        const pl = (window.globalPlayers || []).find(p => p.id === pid);
        const name = (pl?.name || "").toLowerCase();
        const last = name.split(" ").pop() || "";
        won = !!(name && (scorersText.includes(name) || (last.length > 2 && scorersText.includes(last))));
      }

      if (won) {
        const win = Math.floor(Number(bet.amount || 0) * Number(bet.odds || 2));
        await db.ref("bets/" + id).update({ status: "won", payout: win, settledAt: new Date().toISOString() });
        starsDelta += win;
      } else {
        await db.ref("bets/" + id).update({ status: "lost", payout: 0, settledAt: new Date().toISOString() });
      }
      settledIds.push(id);
    }

    if (starsDelta > 0) {
      const newStars = currentStars + starsDelta;
      await db.ref("users/" + currentUser.uid).update({ stars: newStars });
      if (userProfile) userProfile.stars = newStars;
      updateUserUI();
      showToast("Выигрыш по ставкам: +" + starsDelta + " ⭐");
    } else if (settledIds.length) {
      updateUserUI();
    }
    renderMyBets();
  } catch (e) {
    console.warn("settle bets", e);
    if (e && e.message) console.warn(String(e.message));
  }
}

async function renderMyBets() {
  const el = document.getElementById("my-bets-list");
  if (!el) return;
  if (!currentUser) {
    el.innerHTML = "<p class='empty-hint'>Войдите, чтобы видеть свои ставки</p>";
    return;
  }
  const snap = await db.ref("bets").orderByChild("userId").equalTo(currentUser.uid).once("value");
  const list = Object.entries(snap.val() || {}).map(([id, b]) => ({ id, ...b }))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 20);

  if (!list.length) {
    el.innerHTML = "<p class='empty-hint'>Ставок пока нет</p>";
    return;
  }

  el.innerHTML = list.map(b => {
    const m = globalMatchesForBets.find(x => x.id === b.matchId);
    const home = globalTeamsForBets.find(t => t.id === m?.homeId)?.name || "?";
    const away = globalTeamsForBets.find(t => t.id === m?.awayId)?.name || "?";
    const pickLabel = b.pick === "home" ? "П1" : b.pick === "away" ? "П2" : "X";
    const st = b.status === "won" ? "выигрыш" : b.status === "lost" ? "проигрыш" : "открыта";
    const stClass = b.status === "won" ? "bet-won" : b.status === "lost" ? "bet-lost" : "bet-open";
    return `<div class="my-bet-item ${stClass}">
      <span>${home} — ${away}</span>
      <span>${pickLabel} · ${b.amount}⭐ · кф ${b.odds}</span>
      <span>${st}${b.status === "won" ? " +" + (b.payout || 0) : ""}</span>
    </div>`;
  }).join("");
}

// ========== МАГАЗИН ==========
async function loadShop() {
  const snap = await db.ref("shop").once("value");
  globalShop = Object.entries(snap.val() || {}).map(([id, p]) => ({ id, ...p }));
  renderShop();
}

function renderShop() {
  const el = document.getElementById("shop-list");
  if (!el) return;
  if (!globalShop.length) {
    el.innerHTML = "<p class='empty-hint'>Магазин пуст. Товары добавляются в админке.</p>";
    return;
  }
  el.innerHTML = globalShop.map(p => `
    <div class="shop-card">
      <img src="${p.image || "https://via.placeholder.com/200x140?text=Товар"}" alt=""
           onerror="this.src='https://via.placeholder.com/200x140?text=Товар'">
      <div class="shop-body">
        <h3>${p.name}</h3>
        <p>${p.description || ""}</p>
        <div class="shop-footer">
          <span class="shop-price">${p.price || 0} ⭐</span>
          <button type="button" class="btn-save shop-buy" data-id="${p.id}">Купить</button>
        </div>
      </div>
    </div>
  `).join("");

  el.querySelectorAll(".shop-buy").forEach(btn => {
    btn.addEventListener("click", () => buyProduct(btn.dataset.id));
  });
}

async function buyProduct(productId) {
  if (!currentUser || !userProfile) {
    showToast("Войдите, чтобы покупать", true);
    openAuthModal("login");
    return;
  }
  const product = globalShop.find(p => p.id === productId);
  if (!product) return;
  const price = Number(product.price) || 0;
  if (price > (userProfile.stars || 0)) return showToast("Недостаточно звёзд", true);

  const newStars = (userProfile.stars || 0) - price;
  try {
    await db.ref("users/" + currentUser.uid).update({ stars: newStars });
    await db.ref("purchases").push({
      userId: currentUser.uid,
      productId,
      productName: product.name,
      price,
      date: new Date().toISOString()
    });
    userProfile.stars = newStars;
    updateUserUI();
    showToast("Куплено: " + product.name);
  } catch (err) {
    showToast(err.message, true);
  }
}

// ========== ПОИСК НА САЙТЕ ==========
function onSiteSearch(e) {
  const q = (e.target.value || "").trim().toLowerCase();
  const results = document.getElementById("search-results");
  if (!results) return;

  if (q.length < 2) {
    results.style.display = "none";
    results.innerHTML = "";
    return;
  }

  const players = (window.globalPlayers || []).filter(p =>
    (p.name || "").toLowerCase().includes(q) ||
    (p.teamName || "").toLowerCase().includes(q)
  ).slice(0, 8);

  const teams = (window.globalTeams || []).filter(t =>
    (t.name || "").toLowerCase().includes(q) ||
    (t.city || "").toLowerCase().includes(q)
  ).slice(0, 5);

  if (!players.length && !teams.length) {
    results.innerHTML = "<div class='search-item'>Ничего не найдено</div>";
    results.style.display = "block";
    return;
  }

  let html = "";
  if (teams.length) {
    html += "<div class='search-group'>Команды</div>";
    teams.forEach(t => {
      html += `<div class="search-item" data-type="team" data-id="${t.id}">⚽ ${t.name}</div>`;
    });
  }
  if (players.length) {
    html += "<div class='search-group'>Игроки</div>";
    players.forEach(p => {
      html += `<div class="search-item" data-type="player" data-id="${p.id}">👤 ${p.name} <small>${p.teamName || ""}</small></div>`;
    });
  }
  results.innerHTML = html;
  results.style.display = "block";

  results.querySelectorAll(".search-item[data-id]").forEach(item => {
    item.addEventListener("click", () => {
      const id = item.dataset.id;
      if (item.dataset.type === "player") {
        const player = (window.globalPlayers || []).find(p => p.id === id);
        if (player && typeof openPlayerModal === "function") openPlayerModal(player);
      } else {
        const team = (window.globalTeams || []).find(t => t.id === id);
        if (team && typeof openTeamModal === "function") openTeamModal(team);
      }
      results.style.display = "none";
    });
  });
}

// expose for app.js
window.setBetContext = setBetContext;
window.loadShop = loadShop;
window.initUserSystem = initUserSystem;
