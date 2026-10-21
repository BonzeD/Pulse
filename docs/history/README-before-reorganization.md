> Текущая доработка: **settings-artwork** — [переходы настроек и личные обложки Apple Music](SETTINGS-ARTWORK-1.0.0.md). Поверх kinetic-motion; Viz/GPU/Кинетика и установщик сохранены. Версия 1.0.0. Проверка личных обложек на аккаунте автора и Windows FPS ещё нужна; GitHub не опубликован.

> Предыдущая доработка (история): **kinetic-motion** — [оптимизация кинетики и анимации окон](KINETIC-MOTION-1.0.0.md). Поверх graphics-rollback, без снижения настроек качества и лимита FPS. Версия 1.0.0. Реальные Windows FPS ещё не подтверждены; GitHub не опубликован.

> Предыдущая сборка (история): **graphics-rollback** — [откат графики fix2](GRAPHICS-ROLLBACK-1.0.0.md). Рендеринг возвращён к fix1; исправления кнопок и установщика сохранены. Версия 1.0.0. Возврат FPS на Windows ещё требует проверки.

> Предыдущий кандидат **fix2** (история): [ручка возврата, кнопка редактора и плавность](SMOOTHNESS-1.0.0-fix2.md). Новые Setup, portable и исходники fix2; версия 1.0.0. Публикация на GitHub ещё не выполнена.

> Исправлен преждевременный запуск старой версии из Setup: [INSTALLER-NO-LAUNCH-1.0.0.md](INSTALLER-NO-LAUNCH-1.0.0.md). Исправление сохранено в **fix2**. Описание fix1 ниже относится к предыдущей сборке.

> Актуальная финальная доработка 1.0.0: [FINAL-POLISH-1.0.0.md](FINAL-POLISH-1.0.0.md). Отчёты ниже — история предыдущих сборок.

> Latest 1.0.0 file-video and rounded-light update: [FILE-VIDEO-1.0.0.md](FILE-VIDEO-1.0.0.md). Earlier build hashes and test counts below are historical.

## Current source update: Text Only / Immersion

See [EXPERIENCE-REWORK-1.0.0.md](EXPERIENCE-REWORK-1.0.0.md) for the current behavior and validation limits. Immersion is now a style inside Text Only (T), with **Orbital station** and **Black Sea**, native stage controls and the same transport. Earlier immersion/installer notes describe historical designs.

The installer and its graphics are taken from the supplied Pulse-1.0.0-source(2).zip, while all current application updates are retained. See INSTALLER-IMPORT-1.0.0.md. The desktop widget click-region fix is documented in WIDGET-CLICK-FIX-1.0.0.md. Use `npm run dist` to build the actual Windows payload and setup. Run `npm run test:experience` for the new browser integration checks (Chromium required).

# Pulse

> Первый публичный 1.0.0: portable и установщик собраны из этих исходников. [Проверки и ограничения](docs/build-verification.md). Запуск в Windows/Windhawk и установка/удаление здесь не проверялись.

**1.0.0 · Windows x64 · GPL-3.0-or-later**

Неоновый музыкальный клиент: каталоги YouTube Music, Apple Music и Spotify, тексты песен, GPU-визуализации, MineRadio и офлайн-загрузки.

> Независимый проект, не официальный клиент перечисленных сервисов. Доступность каталога, авторизации и воспроизведения зависит от сервисов, региона и прав на контент. Не обещает обход DRM или платной подписки.

## Запуск

Скачайте installer или portable из Releases этого репозитория. Перед обновлением завершите старый Pulse через **«Выход» в трее** и сохраните копию пользовательской библиотеки. Устанавливайте приложение в отдельную папку Pulse. Пользовательский профиль не сбрасывается.

Сборки не подписаны сертификатом разработчика; Windows может показывать предупреждение. Не отключайте антивирус/SmartScreen ради запуска.

## Windows Media Session / Windhawk

Pulse поставляет собственный SMTC-мост `resources/media-bridge/PulseMediaBridge.exe`. Он публикует название, исполнителя, обложку, состояние и позицию трека; принимает Play, Pause, Next, Previous и перемотку. Мост не воспроизводит вторую копию музыки и не внедряется в Explorer.

Мод Windhawk **Island Media Controls** остаётся отдельным внешним модом. Его исходник в Pulse не включён; новый мини-трей удалён. Старый отдельный desktop-виджет сохранён.

Инструкция и ограничения: [docs/windows-media-session.md](docs/windows-media-session.md). Совместимость с реальным Windows/Windhawk требует проверки перед публичным релизом.

## Разработка и сборка

Нужны **Node.js 24**, **.NET SDK 8**, доступ к npm/NuGet и артефактам Electron. .NET runtime конечному пользователю устанавливать не требуется: медиамост self-contained.

```sh
npm ci
npm test
npm run build:media
npm start
```

Полная Windows x64 сборка на Linux (без Wine):

```sh
npm run dist
```

Для установщика требуются Chromium, Python 3 + Pillow; NSIS загружается electron-builder. Путь браузера для генератора UI можно указать через `CHROMIUM`. Для UI-тестов используйте абсолютный путь:

```sh
CHROMIUM_PATH=/usr/bin/chromium node tests/chrome-ui.cjs
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
```

`dist/Pulse-1.0.0-portable.exe` и `dist/Pulse-Setup-1.0.0.exe` — результаты сборки. CI собирает артефакты, но не запускает Windows UI и не публикует релиз автоматически.

## Перед публикацией

- Проверьте [чек-лист Windows](docs/windows-media-session.md), особенно оба движка воспроизведения, pause/resume, seek и закрытие в трей.
- Не загружайте профиль, cookies, токены, скачанную музыку и пользовательские плагины. Они не нужны для сборки.
- Ознакомьтесь с [историческим аудитом](AUDIT-1.0.1.md) и [изменениями текущего выпуска](CHANGES-1.0.0.md). Номер 1.0.0 установлен по решению автора; прежний отчёт 1.0.1 сохранён как история, а не заявление о версии этого пакета.
- Лицензия — [GPL-3.0-or-later](LICENSE); атрибуция — [NOTICE.md](NOTICE.md). Для распространения бинарников предоставляйте соответствующие исходники, включая `native/media-bridge`.

## Авторы и участие ИИ

Авторы проекта: **werxapee** и **Daswi**.

В разработке использовались **Claude**, **ChatGPT** и **Notion AI** — для помощи с кодом, анализом, тестами и документацией. Это указание инструментов, а не утверждение о поддержке проекта компаниями Anthropic, OpenAI или Notion. Решения о публикации и проверка результата остаются за авторами.

Авторы и лицензии сторонних компонентов перечислены в [NOTICE.md](NOTICE.md). Их атрибуция сохраняется независимо от участия ИИ.

Как оформить репозиторий и выпуск: [docs/github-publishing.md](docs/github-publishing.md).

## Для ИИ и разработчиков

Перед изменениями прочитайте [FOR AI.md](FOR%20AI.md) и [AGENTS.md](AGENTS.md).

Последнее исправление: [звук и видео в одном файле, меню над плеером](COMBINED-DOWNLOAD-1.0.0.md).

Оформление стекла: переключатель «Обычное стекло / Liquid Glass» в настройках внешнего вида. См. GLASS-MATERIAL-1.0.0.md.
