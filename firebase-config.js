// ============================================
// FIREBASE CONFIG
// ============================================
const firebaseConfig = {
  apiKey: "AIzaSyDwkGuJuGvIbWgbaaDBgrSXOP6psvazWnY",
  authDomain: "afl-liga.firebaseapp.com",
  databaseURL: "https://afl-liga-default-rtdb.firebaseio.com",
  projectId: "afl-liga",
  storageBucket: "afl-liga.firebasestorage.app",
  messagingSenderId: "900382458173",
  appId: "1:900382458173:web:901c6573a400c1623c4554",
  measurementId: "G-KJEGKKP6KJ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// Email админов (только они могут зайти в admin.html и писать в БД)
const ADMIN_EMAILS = [
  "AFL-LIGA@mail.ru",
  "admin@afl-league.ru",
  "admin@afl.ru"
];

function isAdminUser(user) {
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase());
}

// ============================================
// IMGBB API KEY
// ============================================
const IMGBB_API_KEY = "7211b469b211fbe8eddf7285042eb17d";

async function uploadToImgbb(file) {
  if (!file) return null;
  const formData = new FormData();
  formData.append("image", file);
  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (data.success) return data.data.url;
    throw new Error(data.error?.message || "Upload failed");
  } catch (err) {
    console.error("ImgBB upload error:", err);
    showToast("Ошибка загрузки изображения", true);
    return null;
  }
}

function showToast(msg, isError = false) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function getPlayerPhoto(player) {
  const placeholder = "https://via.placeholder.com/120x120?text=?";
  if (!player) return { url: placeholder, blurred: true };
  const url = player.photo || placeholder;
  const blurred = !player.consent;
  return { url, blurred };
}
