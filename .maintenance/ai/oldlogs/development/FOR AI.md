# Current internal development notes — 1.0.2

This directory is the internal AI archive, moved intact from root docs. Root AGENTS.md was explicitly removed by the author. User-facing English release notes belong in root Logs/1.0.2.md, not here. Runtime files stay in app/. Read verification/DEVELOPER-EXPERIENCE-1.0.2.md (relative to this archive root) for the latest changes. Historical reports below are not current requirements when superseded.

- Версия — только по явной просьбе автора. Keep version 1.0.2 unless the author explicitly asks otherwise. Do not publish GitHub without permission.
- Onboarding inherits Pulse theme, has five steps, reversible draft preferences and durable commit. Existing profiles and libraries are preserved.
- Five right clicks open a separate sandboxed always-on-top developer BrowserWindow. Five left clicks open Prism. No fake local overlay fallback. Native DevTools are intentionally powerful; the companion IPC accepts fixed commands only.
- Mini Prism spectrum uses the existing nine live signal envelopes; silence stays flat, no extra audio graph/RAF. Reduced motion is static. Escape/Enter/double-click close stays intact.
- Track source picker lives under Settings → Client → Audius. Never re-add it above the player bar.
- No global quality/FPS reductions; preserve installer design and original historical hashes. Apply developer-experience inverse before older setup/prism inverses only for historical baselines.

---

> Структура репозитория обновлена: приложение и его внутренние пути находятся в `app/`, документация — в `docs/`. Из корня работают npm ci / npm test / npm start / npm run dist через обёртку. Сборки: `app/dist/`. Подробнее: [структура](../REPOSITORY-LAYOUT.md). Упомянутые ниже относительные runtime-пути считать от app/; старые отчёты лежат в docs/history/.

> Текущая доработка: **widget-drag-fix** — [перетаскивание мини-виджета](../history/WIDGET-DRAG-FIX-1.0.0.md). `.w` нейтрален, фон/текст draggable, кнопки no-drag; закрепление и preview блокируют drag. Версия 1.0.0. Нативное движение проверить на Windows.

> Текущая пересборка: **localization** — [исправления переводов и подготовка GitHub](../history/RELEASE-1.0.0-localization.md). Исправлен конфликт имени функции перевода с таймером UI. Версия 1.0.0; прежние исправления установщика/кнопок, качество и лимит FPS сохранены. Windows-runtime/FPS требуют проверки на Windows; GitHub не опубликован.

> Текущая доработка: **settings-artwork** — [переходы настроек и личные обложки Apple Music](../history/SETTINGS-ARTWORK-1.0.0.md). Поверх kinetic-motion; Viz/GPU/Кинетика и установщик сохранены. Версия 1.0.0. Проверка личных обложек на аккаунте автора и Windows FPS ещё нужна; GitHub не опубликован.

> Предыдущая доработка (история): **kinetic-motion** — [оптимизация кинетики и анимации окон](../history/KINETIC-MOTION-1.0.0.md). Поверх graphics-rollback, без снижения настроек качества и лимита FPS. Версия 1.0.0. Реальные Windows FPS ещё не подтверждены; GitHub не опубликован.

# FOR AI — правила редактирования Pulse

## Мастер настройки, дебаг и цвета Pulse (1.0.2)
- Актуальная доработка: [Setup / Debug / Cover ink](../verification/SETUP-DEBUG-1.0.2.md), поверх Prism Live. Версия остаётся 1.0.2, GitHub не опубликован.
- Новый локальный профиль получает мастер после заставки; существующие профили не трогать. Повторный проход — «Настройки → Основные → Пройти настройку заново». Сохранять top-level onboarding marker, не смешивать его с авторским DEF_SETTINGS. Применять только allow-list и только после успешного durable flush; skip не применяет черновик. Вход необязателен и использует прежний поток сервиса, Audius без входа.
- Пять быстрых ПКМ по Pulse открывают Debug, пять ЛКМ — Prism. Не смешивать жесты. Не добавлять eval, скрытые сбросы, удаление или экспорт аккаунтов/ключей. Автопроверка read-only и не обещает end-to-end успех нативных/сетевых функций.
- В Prism больше нет видимой кнопки сверху и подсказки снизу. Закрытие Esc/Enter/двойное нажатие, screen-reader close сохранён. Надпись переливается сырыми цветами обложки до fixed-accent override; текст/буквы Pulse обязательно data-i18n-skip (s нельзя переводить как секунды). Учитывать reduced-motion, hidden и forced-colors.
- Запускать новые setup-debug.cjs/setup-debug-ui.cjs вместе с Prism и прежними регрессиями. Для старых baseline использовать отдельный setup-debug inverse перед Prism inverse, не переписывать исторические hashes/reports.

## Главные ограничения
- Версию повышать только по явной просьбе автора. Текущая запрошенная версия — **1.0.2**; исправления и пересборки не повышают её автоматически. Согласовывать активные метаданные и имена файлов; исторические отчёты сохранять.
- Сохранять все предыдущие исправления: кликабельный виджет, округлённое свечение обложек, файловый видеоплеер, Immersion внутри «Только текст» (Orbital station и Black Sea; Sakura удалена по прямому запросу автора).
- Использовать исходный установщик из предоставленного автором архива. Не возвращать экспериментальный установщик, не менять его интерфейс и сценарии без отдельного запроса.
- Не удалять и не сбрасывать библиотеку, загрузки, аккаунты, ключи, пользовательские настройки или оригиналы медиафайлов. Исключение по прямому запросу автора: заменять раздельные дорожки одной загрузки проверенным объединённым MP4. Миграции должны быть обратно совместимыми; новые настройки — с безопасными значениями по умолчанию.

## Интерфейс: удобство, красота и визуалы
- Для выпадающих списков применить стиль выпадающего списка как в «Доп. действия» у треков (меню дополнительных действий).
- Использовать общий компонент `renderer/select-menu.js` и `select-menu.css`, а не системное окно выбора ОС. Сохранять реальные значения, обработчики `change` и подписи существующих `select`.
- Меню должно помещаться в окно, открываться вверх или влево при нехватке места, прокручиваться, поддерживать клавиатуру, Escape, видимый фокус и сенсорное управление. На узких экранах вложенные меню открываются с кнопкой «Назад».
- В «Скачать» размещать выбор «Только аудио» / «Вместе с видео». Не дублировать скачивание видео отдельным верхнеуровневым пунктом.
- Следовать текущей теме приложения: скруглённые поверхности, спокойная подсветка, единая типографика и иконки. Сияние обложки повторяет её скругление, а не прямоугольник родителя.
- Эффекты курсора не перекрывают клики, не перехватывают перетаскивание и учитывают reduced-motion. Не создавать постоянные циклы перерисовки для статичных меню.
- Новые тексты локализовать на русский, английский, японский и украинский. Не переводить названия треков, имена исполнителей и текст песен.

## Офлайн и воспроизведение
- Локальные и скачанные файлы воспроизводятся с устройства без YouTube iframe и без обязательного интернета.
- Контейнер MP4/WebM сам по себе не доказывает наличие видео. Проверять реальную видеодорожку через probe; встроенная обложка не считается видео.
- Скачивать видео в отдельную временную папку, проверять обе дорожки и только затем публиковать готовый файл `.video.*`. Уже скачанное аудио не считается успешным скачиванием видео.
- «Вместе с видео» означает один итоговый MP4 с настоящими аудио- и видеодорожкой. Проверять обе дорожки; только после проверки и успешной публикации удалять отдельные старые медиафайлы этого же ID. При ошибке объединения сохранять старые файлы. Уже скачанные раздельные дорожки объединять локально при открытии видео, без интернета.
- Сохранять общий транспорт, паузу, позицию и громкость. Не запускать одновременно два источника звука. Защищать асинхронные ответы от переключения на устаревший трек.
- Если видео не было сохранено старой сборкой, его невозможно восстановить из аудио: предложить повторную загрузку через «Скачать → Вместе с видео» при наличии интернета.

## Безопасность и проверка
- Renderer передаёт ID каталога, а не произвольные пути. Сохранять проверки IPC, Host/origin, диапазонов HTTP и защиты от traversal/symlink.
- Конвертировать только в отдельный кэш, не перезаписывать оригинал. Файлы `.part`, раздельные потоки `.fNNN` и временные папки не показывать как готовые загрузки.
- Перед выпуском запускать unit/regression и UI-проверки, проверять реальные аудио/видеофайлы, перезапуск каталога без сети, меню на 1366×768 и 390×844, виджет и сохранность исходного установщика.
- Исторические baseline, отчёты и контрольные суммы не перезаписывать. Допускаемые изменения проверять точечно и отдельно тестировать новое поведение.
- Проверять содержимое Setup, portable и исходного ZIP. Не утверждать, что Windows-установка или Windows-runtime проверены, если фактически использовался только Linux/Chromium.

- Контекстные и вложенные меню размещать близко к плееру: зазор 8 px от панели. Выступающую кнопку скрытия обходить только при реальном пересечении по горизонтали; не поднимать все меню из-за кнопки на другом краю. Длинные меню прокручиваются.
- Все выпадающие меню используют одинаковую полупрозрачность и blur, без принудительной заливки .94/.98. Режимы «Обычное стекло» / «Liquid Glass» переключаются через ui.surfaceMaterial, сохраняются и применяются без перезапуска.
- Liquid Glass — веб-имитация внутри приложения, не нативная прозрачность окна Windows. Не включать прежние native material/glassMode режимы. Эффект применяется к панелям навигации, меню и кнопкам, не искажает текст/обложки; преломление — только backdrop. Слабый ПК, forced-colors и reduced-transparency используют безопасный fallback. Никаких постоянных циклов рендера для стекла.

- Оптика Liquid Glass: прозрачный центр, выпуклая squircle-кромка по производной профиля, закон Снеллиуса (n=1.5), карта смещения и направленный блик по реальному размеру элемента. Не заменять это одним сильным blur или непрозрачной серой заливкой. Транспорт — Clear, текстовые меню — более тёмный Regular. Карты ограничены 24 видимыми поверхностями; меню имеют приоритет над мелкими кнопками. Не искажать foreground.
- Для thin-scrollbar Chromium обязательно задавать `scrollbar-color` вместе с тёмным `color-scheme`: стандартные свойства могут перекрывать webkit-псевдоэлементы. Две области настроек сохраняют независимую прокрутку, клавиатуру и доступность; не скрывать баг через overflow:hidden или удаление скролла. Forced-colors возвращает системные цвета.

- Liquid Glass: параметры в `ui.glassFx`, пользовательские пресеты в `ui.glassPresets` (до 20), только проверенные JSON-данные до 64 КБ. 13 включаемых слоёв, 7 встроенных пресетов. Настройки меняются без пересоздания DOM во время движения ползунка; доступность и экономный режим имеют приоритет.
- «Погружение»: `sakura` удалена по прямому запросу автора; старый выбор безопасно отображает orbit, не сбрасывая профиль. Пауза не снижает частоту рендера сама по себе; reduced-motion и экономия сохраняют ограничения. Не обещать 60 fps на любой видеокарте.

## Материал и закреплённый предпросмотр
- `ui.surfaceMaterial` выбирается общим custom dropdown: реальный `select[data-sel="ui.surfaceMaterial"]`, значения `blur`/`liquid`, существующий обработчик `change` и сохранение профиля.
- Вся группа Liquid Glass сворачивается; предпросмотр использует локальный CSS `position:sticky` внутри `.glass-editor`, а не `fixed`. Вышестоящая карточка использует `overflow:clip`, чтобы не создать ложный scrollport. Не закреплять за пределами этой группы.
- Контролы учитывают высоту предпросмотра через `scroll-margin-top`; проверить кликабельность, клавиатуру и границу группы в `tests/material-sticky-ui.cjs` на 1366×768 и 390×844, вкладки «Внешний вид» и «Интерфейс».

## Спокойный стандартный Liquid Glass
- Пресет `original` теперь с мягкой оптикой: слабая кромка, без sheen/innerShadow/glow и без отдельных линз на кнопках по умолчанию. Выразительные встроенные пресеты сохраняют свою прежнюю базу LEGACY.
- `PulseGlassModel.profile()` обновляет только полностью нетронутый прежний заводской профиль. `normalize()`, импорт, сохранённые пресеты и изменённые вручную параметры НЕ мигрируют. Не заменять это безусловным сбросом `ui.glassFx`.
- Карточки настроек используют спокойный читаемый слой, а не прямую чёрную заливку пользовательского panel tint. Цвет акцента и остальные настройки темы не сбрасывать.
- Предпросмотр показывает мини-плеер с текущим названием, исполнителем и обложкой (или логотипом при отсутствии трека). Внутри нет ложных кликабельных кнопок: транспорт декоративный и aria-hidden.
- Quiet-стили кнопок не должны перекрывать forced-colors, reduced-transparency и perf-lite. Проверять контраст на светлой подложке, старый профиль, сохранённые пресеты и `tests/quiet-glass-ui.cjs` вместе с прежними glass/editor/sticky тестами.

## Транспорт: обычное стекло и припев
- В режиме `blur` материал накладывается на панель целиком, не на каждую `.bar .ib`. Сохранять прозрачные обычные кнопки, отдельный мягкий фон Play, hover/active и системные цвета forced-colors.
- Видимая `.ch-btn.has/.on` — inline-grid с центрированием; проверять реальный bbox рисунка `#i-chorus`, не нулевой размер скрытой кнопки. В мобильной и Clean-сетке у припева явный слот; скрытые действия Clean не должны оживать из-за ID-правил компактной панели.
- Запускать `tests/transport-glass-ui.cjs`: full/clean, blur/liquid, glass on/off, 1366/390, has/on, настоящий CSS scale 1/1.15, отсутствие пересечений, hover/focus/right-click и forced-colors.

## Главная и настройки: оптимизация прокрутки
- `data-page` выставляется в renderRoute. Полки Home используют content-visibility:auto и сохранённый intrinsic-size; в `.cz-edit` это отключено. Не удалять карточки или обработчики ради производительности.
- `home-performance.js` пассивно отслеживает только прокрутку Home. `data-home-scrolling` сохраняется только как признак прокрутки; по последнему запросу НЕ снимать SVG-displacement при прокрутке. Использовать постоянные кэшированные карты, без RAF и без изменения FPS/audio/settings. Доступность и экономный режим имеют приоритет.
- По последнему запросу автора группы настроек используют `--ds-s1`, как фон панели страниц, вместо прежнего фиксированного RGB. Нижняя маска списков отключается в forced-colors; нижние поля остаются доступны благодаря padding.
- Актуальный первый автор — werxapee, ссылка остаётся https://github.com/BonzeD. Daswi ведёт на https://github.com/daswiccii-cloud. Имена — настоящие ссылки; открываются через существующий pulse.openUrl. Исторические лицензионные уведомления не переписывать.
- По последнему запросу автора установщик переведён на английский. tests/installer-english-map.json фиксирует разрешённые замены: их обратное применение вместе с werxapee → Bon_zeD даёт исходный SHA-256 сценария. Дизайн и логика прежние.
- WASAPI Exclusive не реализован: не выдавать AudioContext latencyHint/setSinkId или фиктивный переключатель за эксклюзивный/bit-perfect вывод. Нужны отдельный нативный тракт и Windows-тесты.

## Темы, фоны и обновлённый мини-виджет
- Последний прямой запрос автора: установщик и деинсталлятор на английском. Переведены графические экраны, подписи окон, сообщения, метаданные и системный язык NSIS. Исходные раскладка, интерактивные зоны, DPI-масштабы и сценарии установки/удаления сохранены. `tests/installer-original.cjs` обращает только разрешённые полные строковые литералы, не идентификаторы и пути, и сверяет исторический SHA-256.
- `look.background` — обратно совместимое расширение: `default` оставляет прежний фон, `solid` — первый цвет, `gradient` — два цвета и угол, `image` — локально обработанная копия изображения. Смена готовой темы не удаляет фон.
- Фото: JPG/PNG/WebP/AVIF до 20 МиБ; проверяются MIME и сигнатура, не разрешать SVG, пути или удалённые URL. Декодирование и JPEG-копия до 2048 px по длинной стороне и 1,5 млн символов выполняются локально; оригинал не меняется. Временный Blob URL освобождается. Копия входит в настройки и их экспорт; это изображение пользователя, не секретный файл ОС.
- Для фона один фиксированный слой без RAF/scroll-обработчиков, `contain:strict`. Настраиваемое размытие применяется только к фото; forced-colors скрывает декоративный слой. В режиме custom фона сохранённые эффекты обложки не стираются, а временно скрываются. Выбор `default` возвращает их.
- Виджет наследует фон панели и цвета текста/акцента через существующий `widgetCfg`, без нового IPC. Стандартный размер использует обложку 80 px; явная старая Neon-тема сохраняет прежние 108 px. Сохранены редактор, перестановка/масштаб элементов, пользовательские цвета, blur, тихий режим, no-drag у кнопок, progress/volume и управление окном. При пустой очереди старая обложка убирается.
- Проверять `tests/theme-background.cjs`, `tests/theme-widget-ui.cjs` и `tests/widget-clicks.cjs`, а также прежние sticky/transport/video/Home проверки. Нативные Windows hit-testing/установка и реальные FPS требуют проверки на Windows.

## Финальная доработка
- Liquid Glass больше не отключает преломление при прокрутке. Сохранять кэш карт и доступные fallback.
- FIX1: установщик/деинсталлятор НИКОГДА не запускают установленный Pulse.exe для завершения. Старые версии не понимают --quit-for-update и открываются. Закрывать только уже существующие процессы через Windows taskkill /T, затем /T /F, ожидать освобождения файлов. Единственный запуск приложения — кнопка запуска на экране успешного завершения. Оформление не менять.
- Discord Application ID публичен, не секрет. Никогда не добавлять bot token/client secret в клиент. Rich Presence — только проверенные поля и HTTPS-ссылки.
- Украинская локализация — код uk, uk-UA, словарь locales-uk.js, виджет, tray и Mineradio. Пользовательские метаданные и тексты песен не переводить.

- После удаления Sakura старое значение `kWorld=sakura` переходит на orbit без сброса остального профиля. Исходники/фон Sakura не включать в приложение; исторические отчёты и лицензии сохранять.
- Эффекты проверять `tests/final-effects.cjs` и `tests/final-ui-smoke.cjs`: density/size/glow/hue должны работать в Canvas и GPU, а trails/flash/mirror корректно переключать прямой GPU-путь на совместимый. Cover Pulse относится только к видимой обложке; BG Dim — к фону.
- Верхняя ручка `visualReturn` — два шеврона вниз и три штриха, без изменения очереди/воспроизведения. На узком окне не перекрывать переключатель режимов.
- Публичный прокси обложек: image-cache.js — HTTPS allowlist, проверка каждого redirect, таймаут и лимит 8 МиБ, без cookies; подписанные URL не переписывать. Ошибки не кэшировать. Playlist repair ограничен двумя запросами.
- Исторические контрольные суммы не заменять. `tests/final-approved.json` — отдельные точные обратные патчи только разрешённых автором правок; новые поведения дополнительно проверяются без обратных патчей в final-release/final-effects/final-ui-smoke.
- Для финальных проверок: `npm test`, `node --test tests/final-release.cjs`, `npm run test:final-ui`, `npm run test:final-effects`. В Windows проверить обновление играющего Pulse, SMTC, Win hit-testing и реальный GPU. Не выдавать Linux-тесты за Windows-прогон.

## Запрет запуска старой версии — fix1
- Исторический дефект прежней финальной сборки: ExecWait установленного Pulse.exe с неизвестным старой версии аргументом запускал старое приложение и мог ждать его закрытия. Не возвращать такую совместимость.
- Регрессия: tests/final-release.cjs проверяет отсутствие запуска в секциях установки/удаления и единственный запуск из FinClick. 242 теста проходят. Windows-сценарий по-прежнему проверять отдельно.

## Fix2: кнопки и плавность перед GitHub
- Ручка visualReturn показывается при pp-open во всех основных режимах cover/video/visual; не ограничивать mode-visual. Отдельная lyonly-сцена имеет собственный выход. Малое окно: переключатель ниже ручки.
- edBox: ed-preview-actions ПЕРЕД inner, нормальный поток, без absolute, минимальная высота кнопки 44 px; проверять Discord при 390/1366/1919 и zoom 1/1.25 и настоящий переход czPart.
- PulseBackdropRenderer не путать с PulseBackground (редактор пользовательских фонов). Единственный worker, одна активная и максимум три ожидающих задачи, отмена разрешается null и удаляет ошибочный кэш. PNG и неизменный стационарный RGB-дизеринг; резервный путь асинхронный, с уступкой UI. Не возвращать синхронное PNG-кодирование в app.js.
- Viz: не присваивать canvas.width/height при неизменных размерах — это стирает изображение. MediaQueryList кэшировать, но не само значение matches.
- tests/background-render-ui.cjs + final-ui-smoke.cjs, npm test, FX 280, widget 66 и file-video. Синтетические long-task числа не выдавать за FPS на Windows. GitHub без прямой команды не публиковать.

## Текущий прямой запрос: откат графики fix2
- Эта секция имеет приоритет над прежними указаниями по Worker в fix2. Не возвращать PulseBackdropRenderer/background-render.js: автор попросил откат графических изменений после падения FPS. app.js/viz.js восстановлены точно из source-fix1.zip.
- Сохранить расширенную видимость visualReturn и ed-preview-actions, а также запрет запуска старого EXE при установке/удалении.
- Не уменьшать лимит FPS/качество и не выдавать откат за доказанное устранение FPS-регрессии. Требуется реальное сравнение на Windows. MineRadio, lyStage и GPU-реализации не менялись при этом откате.
- Актуальные документы: GRAPHICS-ROLLBACK-1.0.0.md, docs/rollback-checks/. Старые отчёты fix2 исторические. Версию менять только по просьбе автора, GitHub без команды не публиковать.

## Текущая доработка: visual frame pacing
- По запросу об устранении скачков FPS добавлен renderer/frame-pacer.js. Direct coverfield/radial рисуются из основного RAF до DOM-записей, без собственного второго RAF. Настройки FPS/качества, высокочастотные обновления текста, звук, MineRadio и Immersion не снижать/не переписывать.
- Пустой скрытый Canvas не чистить каждый GPU-кадр; при переходе к Canvas/copy вернуть правильную видимость. Кэшировать FFT-границы по размеру спектра и sample rate, MediaQueryList — с живым matches. Не присваивать неизменные canvas.width/height.
- Не возвращать background-render Worker и экспериментальные GPU-флаги. Исторические baseline сохраняются; точные обратные diff находятся в tests/visual-performance-approved.json. Новое поведение проверяют frame-pacing.cjs и visual-performance.cjs.
- Проверки и Windows acceptance: docs/verification/VISUAL-PERFORMANCE-1.0.0.md. Linux/SwiftShader и симуляции планировщика НЕ подтверждают стабильные 120 FPS на Windows. Версию менять только по просьбе автора; дизайн и сценарии установщика сохранять; GitHub без команды не публиковать.

## Пословный редактор — пересборка 1.0.1
- Единственный вход — «Свой текст» в корректоре. Не добавлять пункт в основную навигацию без просьбы.
- Enhanced LRC/поле корректора и UI двусторонне синхронизированы; применение только по сохранению, черновик локальный и привязан к треку. Не терять невалидный незавершённый ввод.
- Удержание стрелок: реальное аудио, скорость по умолчанию 0.5×; назад — короткие фрагменты, не заявлять настоящий reverse. Всегда отменять работу/восстанавливать скорость при отпускании, blur/visibility/выходе; устаревшая сессия не трогает новую песню.
- Не уменьшать FPS/качество ради редактора, не менять прежние графические исправления. Версия остаётся 1.0.1 до следующей явной просьбы.
- Проверки: `npm test`, `npm --prefix app run test:lyric-studio`; Windows и реальные сервисы проверять отдельно. Подробнее: `docs/verification/LYRIC-STUDIO-1.0.1.md`.

## Иконки редактора, паузы и «Без слов» — 1.0.1
- Иконки действий — локальные официальные Lucide с лицензией и pinned provenance; сохранять aria-label/title на всех языках и минимум 44×44. Текст слов/строк не заменять иконками. Галочка — «Готово»/выход к корректору, дискета применяет текст.
- Открытый редактор отключает native drag-region у лежащей под ним .top и своих элементов. Не проверять Windows hit-testing одним z-index/DOM-кликом.
- Явная пустая строка LRC `[mm:ss.xx]` — три точки до следующей отметки/конца песни. Сохранять в модели, сыром тексте, черновике и экспорте; не превращать в слово «…». Короткие и последние паузы не терять. Исторические baseline не менять; точная обратная правка — lyric-silence-approved.json.
- «Без слов»: `_inst` от поиска и жанры/имя исполнителя не доказывают отсутствие вокала. Нужен явный признак записи; известный текст — veto. Не добавлять несовместимый seed и не возвращать старую очередь из завершившегося запроса после смены фильтра. Не называть это распознаванием вокала в аудио.

## Canvas/виджет hotfix — 1.0.1
- Не возвращать стандартный shadowBlur на каждый примитив девяти groupedGlowStyles. Чёткая геометрия — полный выбранный DPR, отдельно кэшируемые слои bloom; не уменьшать density/FPS и не переписывать настройки. Сохранять additive fire/rays, шлейфы, зеркало, индивидуальные glow остальных стилей и GPU fallback.
- «Созвездие» использует точную сетку соседей без cap связей, с обновлением радиуса под бас. Исторические baseline сохранять; новая обратная правка — canvas-perf-approved.json.
- Виджет показывает сохранённый запрос после загрузки; скрытый/свёрнутый main не должен прятать его запоздалым focus. Отмена запроса при реальном возврате/скрытии, проверка позиции после смены мониторов. Настройки onTop/autoHide/onMin не сбрасывать.
- Проверки и Windows acceptance: docs/verification/CANVAS-WIDGET-HOTFIX-1.0.1.md. Синтетическая растеризация не доказывает Windows FPS; версия остаётся 1.0.1.

## Текущая версия 1.0.2 — аудит 2D и панели
- По новой прямой просьбе автора версия теперь 1.0.2; прежние 1.0.1-секции выше исторические. Согласовывать active package/lock/API/host/installer; повышать дальше только по просьбе. GitHub без отдельной команды не публиковать.
- Панели lyFix/lyPop/vizPop: единый PulseMotion.panel, настоящий DOM на exit, inert/aria-hidden, отмена очистки при reopen, без RAF/клонов; учитывать no-anim и reduced motion. Не очищать popup до завершения выхода. Черновик корректора сохранять.
- fitPop измеряет layout без входного transform и учитывает обрезающий tab. Узкая sidecar-панель не должна сохранять тесные desktop-260px при окне до 480px; сохранённую настройку не перезаписывать.
- Сетку звёзд расширять по ёмкости, не аллоцировать при каждом изменении баса. Не ограничивать связи/частицы/FPS/DPR ради счётчика.
- Удалённые/заменённые preview canvas должны вызывать destroy независимо от существования нового preview. Освобождать собственные bitmap, observer и WebGL2 через canvas.getContext('webgl2') — API PulseGPU не имеет публичного поля .gl. Не уменьшать Canvas вызывающего кода при destroy.
- Проверки: npm test, test:graphics-102, test:panels-102, test:canvas-perf, test:visual-performance, test:final-effects, test:final-ui. Исторические hashes не менять; точная обратная правка — graphics-102-approved.json. Подробности/Windows acceptance: docs/verification/GRAPHICS-MOTION-1.0.2.md.

## Prism startup / Black Sea lighting — 1.0.2
- Preserve `graphics/ocean-rock-surface.mjs`: area-weighted coincident-position normals, separate UVs, stable tangents prepared once after deformation; never recompute the surface in the frame loop. Do not restore the ~62° UV seam normal discontinuity.
- Black Sea composer has supported, bounded MSAA before bloom; Orbit retains its prior composer sample count. Keep normal-map specular AA, wet rock lighting, water and audio response. Do not reduce resolution/DPR/FPS/density to claim the shimmer is fixed. Actual Windows GPU performance still needs hardware testing.
- `splash.js`/`splash.css` implement Prism: large Pulse wordmark and original glass shader, not a second player. Keep existing startup/motion switches, reload suppression, hidden/tray wait, 1800/4500 ms bounds, skip controls, RU/EN/JA/UK captions, reduced-motion/forced-colors/no-WebGL fallbacks and complete RAF/context/listener cleanup. Do not force a long intro or replay it on tray return.
- New regressions: `tests/ocean-lighting-ui.cjs`, `tests/prism-splash-ui.cjs`, plus appended behavioral tests in immersion-graphics/motion-unit. Report: `docs/verification/PRISM-LIGHTING-1.0.2.md`. Historical baseline hashes/reports remain unchanged. Version is still 1.0.2; publication requires a separate request.

## Prism Live easter egg / startup optimization — 1.0.2
- Five fast activations on the existing `#brand` (within 1600 ms, each gap <=450 ms) open the persistent Prism lens. Do not add a timer dismissal or make ordinary logo clicks stop navigating home. Preserve keyboard activation, Escape/Return, focus/inert restoration, four locales, startup-disabled entry and static reduced-motion/forced-colors fallbacks.
- `splash.js` exports `PulsePrismArt` before startup opt-out; only the explicitly opened controller in `prism-live.js` reads `readSpectrum` with existing output/viz lag. `prism-signal.js` has time-based real FFT/waveform envelopes, no synthetic beat. Never create a second player/AudioContext, request a microphone or persist visualizer state to the user's settings.
- Keep nine vanes, shared uniform arrays, CPU-prepared lane trigonometry, near-lane shader rejection, unchanged framebuffer guard, one draw/triangle, no postprocessing and bounded decorative cadence. Do not change the primary viz resolution/FPS/density or claim a measured Windows speedup from software tests.
- Preserve immediate document/native hidden-window pause, complete WebGL/RAF/listener release, fresh canvas after a released context, and suspension/resumption of invisible main/lyrics/Immersion/MineRadio rendering without mutating stage choices or stopping audio. Shared Space controls the real transport.
- Tests/report: `prism-signal.cjs`, `prism-live-ui.cjs`, `prism-integration-ui.cjs`, `prism-splash-ui.cjs`, `docs/verification/PRISM-LIVE-1.0.2.md`. Historical hashes remain untouched; `prism-live-approved.json` is a separate exact inverse before older historical comparisons. Version stays 1.0.2; Windows/hardware acceptance is separate.
