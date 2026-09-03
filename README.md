# АФЛ — Официальный сайт футбольной лиги (v3)

## Новое в этой версии

- **⭐ Команда тура** — лучшие игроки по голам и передачам после тура
  - Автоматически (топ по статистике), если в админке не задано
  - Или вручную: в админке выбираешь игроков чекбоксами
- **📷 Кнопка «Загрузить фото»** — удобная загрузка с превью во всех формах
- Фото игроков, согласие/блюр, карточки команд и игроков, документы, мобильная версия

## Структура

```
afl-site/
├── index.html
├── admin.html
├── privacy.html / consent.html / terms.html
├── css/style.css
└── js/
    ├── firebase-config.js
    ├── standings.js
    ├── matches.js
    ├── stats.js
    ├── app.js
    └── admin.js
```

## Firebase: новые ветки

- `teamOfTheRound` — команды тура
  ```
  { title, round, players: [playerId, ...] }
  ```
- `players` — поля: photo, consent, birthYear, position, number

## Быстрый старт

1. Вставь Firebase-конфиг и ImgBB-ключ в `js/firebase-config.js`
2. Открой `index.html`
3. Админ → «Команда тура» → выбери лучших игроков тура
