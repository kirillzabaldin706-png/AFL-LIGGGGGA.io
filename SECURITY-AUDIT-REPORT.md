# Отчёт по безопасности АФЛ (код + модель угроз)

Дата: 2026-11-26  
Объект: статический сайт GitHub Pages + Firebase Realtime Database + Firebase Auth + ImgBB

---

## Важно: что технически невозможно на чистом GitHub Pages

| Требование | Реальность |
|------------|------------|
| Ключи API только на сервере | Нужен backend (Cloud Functions / Vercel). Пока сайт ходит в Firebase **из браузера**, web `apiKey` **должен** быть у клиента — так устроен Firebase. |
| Пароль хранить хэшем в своём коде | **Firebase Auth уже хэширует пароли на сервере Google**. Свой MD5/SHA в JS — вредно и не нужно. |
| Параметризованный SQL | У вас **не SQL**, а Firebase RTDB. Аналог — Security Rules + валидация полей. |
| CSRF как для cookie-сессий | Firebase использует ID token, не классические cookie-сессии форм. Риск другой (XSS → кража token). |
| HTTPS | GitHub Pages и Firebase уже по HTTPS. |

---

## Что сделано в этой версии

1. **Жёсткие Firebase Rules** (`database.rules.json`)
   - Контент (команды, матчи, игроки…) — только email админа
   - `stars`: пользователь **только уменьшает** или создаёт профиль ≤ 1000; рост звёзд — только админ
   - Ставки: лимиты суммы/кэфа; нельзя менять amount/odds после создания
   - Предложения: только авторизованные, с `uid`

2. **XSS**
   - `escapeHtml` / `safeImgUrl` в security.js
   - Экранирование новостей и магазина

3. **Лимиты**
   - Вход: max 5 неудачных / 15 мин (localStorage)
   - Ставки / формы: rate limit на клиенте
   - Файлы: только jpeg/png/webp/gif, ≤ 2 МБ

4. **Админка**
   - Кнопка «Админ» на сайте **скрыта** для не-админов
   - `noindex,nofollow` на admin.html
   - Проверка `isAdminUser` + Rules

5. **CSP + upgrade-insecure-requests**
   - Ужесточённые meta CSP на index/admin

6. **Отладка**
   - `console.log` глушится при `AFL_DEBUG = false`

7. **Магазин**
   - Цена берётся из каталога Firebase, не из «произвольного» поля в запросе покупки (клиент всё ещё может подменить свой JS — Rules не хранят «цену товара» в purchases жёстко; полный контроль — Cloud Function)

8. **Выигрыши ставок**
   - Автоначисление выигрыша себе **отключено** правилами (нельзя накрутить stars). Начисление — админ вручную.

---

## «Попытка взлома» (анализ кода, без атаки на чужие системы)

| Вектор | Результат | Критичность |
|--------|-----------|-------------|
| Открыть apiKey в Sources | Ключ виден (норма для Firebase Web) | Низкая, если Rules строгие + ключ ограничен доменом |
| Запись в `/teams` без админа | **Deny** по Rules | Закрыто |
| Регистрация + `users/uid/stars = 999999` | **Deny** (только ≤1000 при создании, потом только вниз) | Закрыто |
| Купить товар за 0 ⭐ подменой JS | Клиент может вызвать update stars; Rules не дадут **увеличить**, но **не спишут «правильно»** без Function | Средняя — нужен Cloud Function checkout |
| XSS через новость | Смягчено escapeHtml | Средняя → низкая |
| Брутфорс пароля админа | Лимит на клиенте легко обойти; серверный лимит — Firebase / Identity Toolkit | Средняя — сильный пароль + 2FA Google |
| Прямой URL `/admin.html` | Страница грузится, без пароля админа запись в БД **Deny** | UI «спрятан», API закрыт Rules |
| ImgBB key в клиенте | Можно жечь чужой квотой | Средняя — вынести upload в Cloud Function |
| Утечка ключей в git/чатах | Ключи уже светились ранее | **Сменить** ImgBB key; ограничить Firebase API key по HTTP referrer |

---

## Обязательные ручные шаги (сделай сам)

1. Firebase Console → Realtime Database → **Rules** → вставить `database.rules.json` → **Publish**
2. Google Cloud → Credentials → API key → **Application restrictions: HTTP referrers**  
   `https://kirillzabaldin706-png.github.io/*`  
   `https://*.github.io/*` (если нужно)
3. **Сменить пароль** админа (длинный, уникальный)
4. Включить **2FA** на Google-аккаунте Firebase/GitHub
5. ImgBB: **перевыпустить API key** (старый мог светиться)
6. Git history: ключи в истории GitHub **не удаляются** простой заменой файла — нужен `git filter-repo` / BFG или новый репозиторий + revoke ключей

---

## Что даст «железную» защиту (следующий этап)

- Firebase **Cloud Functions**: upload картинок, checkout магазина, settlement ставок, начисление звёзд
- Секреты только в Functions config / Secret Manager
- App Check (reCAPTCHA) против ботов

Без Functions требования «все ключи только на сервере» и «цена только на сервере» **невыполнимы** полностью на статике.

---

## Итог

Защита **существенно усилена** для любительской лиги на Firebase.  
Полный чеклист «как у банка» = **backend**.  
Сейчас критично: **Publish Rules**, **domain lock API key**, **сменить пароль и ImgBB key**.
