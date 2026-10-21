# Плагины Pulse

Плагин — обычный `.js`-файл в папке `%APPDATA%\Pulse\plugins` (Настройки → Плагины → «Открыть папку»).
Файлы загружаются при старте по алфавиту; включать/выключать можно там же, без удаления.
Пример: `example-visual.js.off` — убери `.off`, нажми «Перезагрузить».

## API (`window.Pulse`)

| Метод | Что делает |
|---|---|
| `registerVisual({ id, name, icon, cover, draw(g) })` | Новая визуализация. `cover: 'show'` — обложка в центре, `'hide'` — во весь экран |
| `setVisual(id)`, `visuals` | Переключить / список стилей |
| `addSettingsTab({ id, icon, title, rows })` | Вкладка настроек. `rows` — массив или `(ui) => [...]`, где `ui.row(title, sub, html)`, `ui.group(title)` |
| `addTrackMenuItem((track) => [icon, label, onClick])` | Пункт в меню «⋯» трека (верни `null`, чтобы не показывать) |
| `addIcon(id, viewBox, svgInner)` | Своя SVG-иконка; потом указывай `icon: id` |
| `toast(text, icon)` | Уведомление |
| `on(event, fn)` | События: `ready`, `track`, `line`, `lyrics`, `beat` (`{ n, bpm }`) |
| `player.toggle/next/prev/seek(s)/time()/duration()/playing()/current()/volume(v)/tempo()/bands()` | Управление плеером |
| `lyrics.lines()/current()/openCorrector()` | Текст песни |
| `storage(ns).get(key, def)/set(key, value)` | Сохранение настроек плагина |

## Кадр визуализации `g`

`ctx, W, H` — холст; `cx, cy, R` — центр и радиус обложки (в режиме «Визуал» точно совпадает с обложкой);
`bands` (64 полосы 0..1), `bass, mid, high, level, beat, kick`, `wave`;
**темп**: `bpm`, `pos` (дробный номер доли), `phase` (0..1 внутри доли), `bar` (фаза такта из 4 долей),
`beatN`, `tick` (номер доли с плавным «шагом»), `speed` (= bpm/120);
помощники: `mix(f, alpha)` и `col(f)` — цвета палитры обложки, `glow(color, blur)`, `noGlow()`, `rr()`, `smoothClosed(points)`, `ease()`, `TAU`;
`state` — объект для своих данных между кадрами.

Привязывай движение к `g.pos`/`g.tick`, а не ко времени — тогда визуал идёт ровно в темп трека.

## Диджей-пульт (с версии 1.8)

`Pulse.dj` — управление деками из плагина (деки нумеруются 0 и 1):

| Метод | Что делает |
|---|---|
| `play(d)` | плей/пауза деки |
| `cue(d)`, `sync(d)`, `brake(d)` | в начало / подогнать темп и долю / торможение |
| `loop(d, beats)` | луп на N долей (повторный вызов — снять) |
| `hot(d, n)` | хот-кью 0–3 (поставить / прыгнуть) |
| `setK(d, 'low'\|'mid'\|'high'\|'filter'\|'pitch'\|'vol', value)` | ручки канала |
| `xf(0..1)` | кроссфейдер |
| `fx('echo'\|'rev'\|'fb', 0..100)` | эффекты |
| `mix()`, `loadNext()` | автосведение сейчас / загрузить следующий трек в свободную деку |

## 2.0.7: панель «Только текст»
Пока открыт «Только текст», на `body` есть класс `lys-bar` — это тот же `#bar` в виде плавающей панели.
Новые кнопки (видны только в режиме): `#btnLybStyle`, `#btnLybAdd`, `#btnLybQueue`, `#btnLybLy`, `#btnLybView`, `#btnLybFs`;
очередь слева — `#lybQueue`. Настройка `lib.settings.ly.kBar`: `on` | `auto` | `off`.

## 2.0.8: Mineradio в «Только текст»
Сцена Mineradio — фрейм `#mrStage iframe` (`renderer/mineradio/`, GPL-3.0). Пока она на экране, на `body` и `#lyStage` есть класс `mr-on`.
`window.mrActive()` — сцена видна; `window.mrConsole()` — открыть визуальную консоль; `window.mrSync()` — пересчитать состояние.
`window.PulseMR` — мост для фрейма: `time()`, `dur()`, `playing()`, `track()`, `queue()`, `lyrics()`, `freq(u8)`, `wave(u8)`,
`play/pause/toggle/next/prev/seek(s)/playIdx(i)/like()`, `cfg()`. Настройки: `lib.settings.ly.vis = 'mineradio'`,
`ly.mrPreset` (0–7), `ly.mrQuality` (`auto|eco|balanced|high|ultra`), `ly.mrFps` (0 = монитор), `ly.mrLyrics`, `ly.mrShelf`, `ly.mrKeep`.

## 2.0.9

Стиль визуала `coverfield` («Частицы обложки 3D»): обложка разбивается на частицы, яркость пикселя — глубина. На WebGL2 рисует `R.coverField(data, n, key, c)` из `gpu.js` (статический буфер точек `[u, v, lum, rnd, r, g, b]`, ключ `key` — смена обложки), без WebGL — CPU-фолбэк в `draw(g)`.
Настройка `lib.settings.ly.lineFx` — `'line'` (по умолчанию) или `'improv'`: для текстов только с таймингом строк — заливать строку целиком или зажигать угаданные слова по одному. `window.spImprov(L)` — строка `L` сейчас идёт «импровизацией»; `PulseMR.improv()` — то же для фрейма Mineradio.

## 2.0.10 — новый интерфейс
- Новые файлы: `renderer/ds.css` (дизайн-токены `--ds-*` — используйте их в своих темах и плагинах), `renderer/ui.css` (компоненты и каркас), `renderer/shell.js`.
- Каркас «Панели» включён классом `body.ds-panels` (настройка `ui.shell`: `'panels' | 'classic'`). В «Панелях» `#btnShuffle` и `#btnRepeat` лежат в `.bar-l`, а `.time` — прямым потомком `#bar`; id, классы и обработчики прежние. В «Классическом» всё на старых местах.
- `body.bar-all` — показывать все кнопки нижнего плеера (`ui.barAll`). Без него в «Панелях» `#btnDlCur` и `#btnDislike` скрыты (они есть в меню «⋯»), `#btnDj` скрыт при `body.no-dj`.
- Настройки: `ui.setMode` (`'simple' | 'all'`). В простом режиме редкие группы вкладки свёрнуты в `details.set-adv`. Вкладки плагинов (`Pulse.addSettingsTab`) обрабатываются так же; поиск ищет по всему.
- `window.dsPalOpen()` — открыть командную палитру (Ctrl+K). Она ищет по разделам, действиям, плейлистам и строкам всех вкладок настроек (поля `t`, `s`, `k` у строк `R(...)`).
- В `popHtml(title, rows, tab)` внизу появляется «Все настройки…», если `tab` совпадает с id вкладки настроек.
