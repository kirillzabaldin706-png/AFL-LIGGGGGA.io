// ============================================
// USER SYSTEM: регистрация, звёзды, ставки, магазин
// ============================================

const REG_BONUS = 1000;
const DEFAULT_ODDS = { home: 2.0, draw: 2.8, away: 2.2 };

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
    const home = globalTeamsForBets.find(t => t.id === m.homeId)?.name || "Хозяева";
    const away = globalTeamsForBets.find(t => t.id === m.awayId)?.name || "Гости";
    const dateStr = m.date
      ? new Date(m.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      : "";
    return `
      <div class="bet-card" data-match-id="${m.id}">
        <div class="bet-match-title">${home} — ${away}</div>
        <div class="bet-date">${dateStr}</div>
        <div class="bet-odds">
          <button type="button" class="bet-pick" data-pick="home" data-match="${m.id}">П1 <span>${DEFAULT_ODDS.home}</span></button>
          <button type="button" class="bet-pick" data-pick="draw" data-match="${m.id}">X <span>${DEFAULT_ODDS.draw}</span></button>
          <button type="button" class="bet-pick" data-pick="away" data-match="${m.id}">П2 <span>${DEFAULT_ODDS.away}</span></button>
        </div>
        <div class="bet-amount-row">
          <input type="number" min="10" step="10" value="50" class="bet-amount" data-match="${m.id}" placeholder="Сумма ⭐">
          <button type="button" class="btn-save bet-place-btn" data-match="${m.id}">Поставить</button>
        </div>
      </div>
    `;
  }).join("");

  el.querySelectorAll(".bet-pick").forEach(btn => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".bet-card");
      card.querySelectorAll(".bet-pick").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      card.dataset.pick = btn.dataset.pick;
    });
  });

  el.querySelectorAll(".bet-place-btn").forEach(btn => {
    btn.addEventListener("click", () => placeBet(btn.dataset.match));
  });
}

async function placeBet(matchId) {
  if (!currentUser || !userProfile) {
    showToast("Войдите, чтобы ставить", true);
    openAuthModal("login");
    return;
  }
  const card = document.querySelector(`.bet-card[data-match-id="${matchId}"]`);
  if (!card) return;
  const pick = card.dataset.pick;
  if (!pick) return showToast("Выберите исход: П1, X или П2", true);

  const amountInput = card.querySelector(".bet-amount");
  const amount = Math.floor(Number(amountInput?.value) || 0);
  if (amount < 10) return showToast("Минимальная ставка 10 ⭐", true);
  if (amount > (userProfile.stars || 0)) return showToast("Недостаточно звёзд", true);

  const odds = DEFAULT_ODDS[pick] || 2;
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
    showToast("Ставка принята: " + amount + " ⭐");
  } catch (err) {
    showToast("Ошибка ставки: " + err.message, true);
  }
}

async function settleOpenBets() {
  if (!currentUser) return;
  try {
    const [betsSnap, matchesSnap] = await Promise.all([
      db.ref("bets").orderByChild("userId").equalTo(currentUser.uid).once("value"),
      db.ref("matches").once("value")
    ]);
    const matches = matchesSnap.val() || {};
    const bets = betsSnap.val() || {};
    let starsDelta = 0;
    const updates = {};

    Object.entries(bets).forEach(([id, bet]) => {
      if (bet.status !== "open") return;
      const m = matches[bet.matchId];
      if (!m || m.status !== "finished") return;

      const hs = Number(m.homeScore) || 0;
      const as = Number(m.awayScore) || 0;
      let result = "draw";
      if (hs > as) result = "home";
      else if (hs < as) result = "away";

      if (bet.pick === result) {
        const win = Math.floor(bet.amount * (bet.odds || 2));
        updates["bets/" + id + "/status"] = "won";
        updates["bets/" + id + "/payout"] = win;
        starsDelta += win;
      } else {
        updates["bets/" + id + "/status"] = "lost";
        updates["bets/" + id + "/payout"] = 0;
      }
    });

    if (Object.keys(updates).length) {
      if (starsDelta > 0) {
        const newStars = (userProfile.stars || 0) + starsDelta;
        updates["users/" + currentUser.uid + "/stars"] = newStars;
        userProfile.stars = newStars;
      }
      await db.ref().update(updates);
      updateUserUI();
      if (starsDelta > 0) showToast("Выигрыш по ставкам: +" + starsDelta + " ⭐");
    }
    renderMyBets();
  } catch (e) {
    console.warn("settle bets", e);
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
