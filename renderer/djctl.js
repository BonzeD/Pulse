'use strict';
// Pulse 1.9 — полная интеграция с диджейскими пультами.
// • Готовые карты популярных контроллеров (определяются по имени устройства)
// • Импорт карт Virtual DJ (definition + mapper .xml) и Mixxx (.midi.xml) — так поддерживается почти любой пульт
// • Мастер настройки: пошаговое обучение главных кнопок
// • Подсветка кнопок на пульте (LED), «мягкий захват» ручек, режимы джога, инверсия
// • MIDI Clock: вывод темпа (для Virtual DJ, Ableton, света) и синхронизация с внешним клоком
const djc = { clockBpm: 0, clockTicks: [], clockAt: 0, clockOutT: null, clockNext: 0, ledPrev: {}, ledT: null, wiz: -1, caught: {}, listened: new Set(), relMode: {}, bendT: [null, null] };
const DJC = () => (lib.djc = Object.assign({ led: true, soft: true, jog: 'nudge', jogSens: 100, clockOut: '', clockIn: false, follow: false, startStop: false, preset: '' }, lib.djc || {}));
const midiInv = () => (lib.midiInv = lib.midiInv || {});

// ---------- готовые карты ----------
// Ключи: n:<канал 1-16>:<нота>, c:<канал>:<CC>. Значение — действие Pulse; суффикс «!» = инверсия.
const DJC_PRESETS = {
  ddj400: { name: 'Pioneer DDJ-400 / DDJ-FLX4', match: /DDJ-?(400|FLX4)/i, map: {
    'n:1:11': 'play0', 'n:2:11': 'play1', 'n:1:12': 'cue0', 'n:2:12': 'cue1', 'n:1:88': 'sync0', 'n:2:88': 'sync1',
    'c:1:19': 'vol0', 'c:2:19': 'vol1', 'c:1:7': 'high0', 'c:1:11': 'mid0', 'c:1:15': 'low0', 'c:2:7': 'high1', 'c:2:11': 'mid1', 'c:2:15': 'low1',
    'c:7:23': 'filter0', 'c:7:24': 'filter1', 'c:7:31': 'xf', 'c:1:0': 'pitch0!', 'c:2:0': 'pitch1!', 'c:1:33': 'jog0', 'c:2:33': 'jog1', 'c:1:34': 'jog0', 'c:2:34': 'jog1',
    'n:8:0': 'hot0_0', 'n:8:1': 'hot0_1', 'n:8:2': 'hot0_2', 'n:8:3': 'hot0_3', 'n:10:0': 'hot1_0', 'n:10:1': 'hot1_1', 'n:10:2': 'hot1_2', 'n:10:3': 'hot1_3',
    'n:7:70': 'load', 'n:7:71': 'load' } },
  ddjsb3: { name: 'Pioneer DDJ-SB3 / SB2', match: /DDJ-?SB/i, map: {
    'n:1:11': 'play0', 'n:2:11': 'play1', 'n:1:12': 'cue0', 'n:2:12': 'cue1', 'n:1:88': 'sync0', 'n:2:88': 'sync1',
    'c:1:19': 'vol0', 'c:2:19': 'vol1', 'c:1:7': 'high0', 'c:1:11': 'mid0', 'c:1:15': 'low0', 'c:2:7': 'high1', 'c:2:11': 'mid1', 'c:2:15': 'low1',
    'c:7:23': 'filter0', 'c:7:24': 'filter1', 'c:7:31': 'xf', 'c:1:0': 'pitch0!', 'c:2:0': 'pitch1!', 'c:1:33': 'jog0', 'c:2:33': 'jog1', 'c:1:34': 'jog0', 'c:2:34': 'jog1',
    'n:8:0': 'hot0_0', 'n:8:1': 'hot0_1', 'n:8:2': 'hot0_2', 'n:8:3': 'hot0_3', 'n:10:0': 'hot1_0', 'n:10:1': 'hot1_1', 'n:10:2': 'hot1_2', 'n:10:3': 'hot1_3' } }
};
function djcAutoPreset() {
  if (!midi.acc || (lib.midi && Object.keys(lib.midi).length)) return;
  const names = midiNames(); for (const k in DJC_PRESETS) if (names.some((n) => DJC_PRESETS[k].match.test(n))) { djcApplyMap(DJC_PRESETS[k].map, false); DJC().preset = k; save(); toast(`Пульт ${DJC_PRESETS[k].name}: карта подключена автоматически`, 'dj'); return; }
}
function djcApplyMap(map, replace) {
  if (replace) { lib.midi = {}; lib.midiInv = {}; }
  const m = midiMap(), inv = midiInv(); let n = 0;
  for (const k in map) { let a = map[k]; if (!a) continue; if (a.endsWith('!')) { a = a.slice(0, -1); inv[k] = true; } else delete inv[k]; if (!MIDI_KIND[a]) continue; m[k] = a; n++; }
  save(); return n;
}

// ---------- импорт карт ----------
const djcKey = (status, num, ch0) => { const ty = status & 0xf0, ch = (status & 0x0f) + 1; if (ty === 0x90 || ty === 0x80) return `n:${ch}:${num}`; if (ty === 0xb0) return `c:${ch}:${num}`; if (ty === 0xe0) return `p:${ch}`; return null; };
const num = (v) => { if (v == null || v === '') return NaN; v = String(v).trim(); return /^0x/i.test(v) ? parseInt(v, 16) : parseInt(v, 10); };
// Действие Pulse по названию функции (Mixxx key / Virtual DJ action / имя кнопки)
function djcGuess(txt, d) {
  const s = String(txt || '').toLowerCase(); const D = d == null ? '' : d;
  const hot = s.match(/hot_?cue[ _]?(\d)/); if (hot && +hot[1] >= 1 && +hot[1] <= 4 && D !== '') return `hot${D}_${+hot[1] - 1}`;
  if (/crossfader|xfader/.test(s)) return 'xf';
  if (/master_?volume|\[master\].*(volume|gain)|^gain$/.test(s)) return 'master';
  if (D === '') { if (/load/.test(s)) return 'load'; return null; }
  if (/play_pause|\bplay\b|play_?press|^play/.test(s)) return 'play' + D;
  if (/cue_?(default|stop|play|press)|\bcue\b|^cue/.test(s)) return 'cue' + D;
  if (/sync/.test(s)) return 'sync' + D;
  if (/eq_?high|parameter3|\bhigh\b|\bhi\b|treble/.test(s)) return 'high' + D;
  if (/eq_?mid|parameter2|\bmid\b/.test(s)) return 'mid' + D;
  if (/eq_?low|parameter1|\blow\b|bass/.test(s)) return 'low' + D;
  if (/filter|super1|quickeffect|color/.test(s)) return 'filter' + D;
  if (/pitch|rate|tempo/.test(s) && !/bend|nudge|temp_/.test(s)) return 'pitch' + D;
  if (/jog|wheel|scratch|nudge/.test(s)) return 'jog' + D;
  if (/brake|stop/.test(s)) return 'brake' + D;
  if (/beatloop_4|loop 4|auto_loop|loop_?toggle|reloop/.test(s)) return 'loop' + D;
  if (/load/.test(s)) return 'load';
  if (/volume|level|fader/.test(s)) return 'vol' + D;
  return null;
}
function djcParseMixxx(doc) {
  const out = {}; let n = 0;
  doc.querySelectorAll('controls > control').forEach((c) => {
    const g = (c.querySelector('group') || {}).textContent || '', key = (c.querySelector('key') || {}).textContent || '';
    const st = num((c.querySelector('status') || {}).textContent), no = num((c.querySelector('midino') || {}).textContent); if (isNaN(st)) return;
    const dm = g.match(/Channel(\d)/i), d = dm ? (+dm[1] - 1) % 2 : null;
    const a = djcGuess(g.startsWith('[Master]') ? '[master] ' + key : g.includes('Equalizer') || g.includes('QuickEffect') ? key + ' ' + g : key, d); if (!a) return;
    const k = djcKey(st, isNaN(no) ? 0 : no); if (!k || out[k]) return;
    out[k] = a + (c.querySelector('options invert') ? '!' : ''); n++;
  });
  return out;
}
function djcParseVdj(defDoc, mapDoc) {
  const defs = {}; // имя → [{key, deck}]
  defDoc.querySelectorAll('*').forEach((el) => {
    const name = el.getAttribute('name'); if (!name || /^(led|output|light)$/i.test(el.tagName)) return;
    const ch = num(el.getAttribute('channel')); const c = isNaN(ch) ? 0 : ch; let k = null;
    if (el.hasAttribute('note')) k = `n:${c + 1}:${num(el.getAttribute('note'))}`; else if (el.hasAttribute('cc')) k = `c:${c + 1}:${num(el.getAttribute('cc'))}`; else if (el.hasAttribute('pitchbend') || /pitchbend/i.test(el.tagName)) k = `p:${c + 1}`;
    if (!k || /NaN/.test(k)) return; const dk = num(el.getAttribute('deck'));
    (defs[name.toUpperCase()] = defs[name.toUpperCase()] || []).push({ key: k, deck: isNaN(dk) ? (c <= 1 ? c : null) : (dk - 1) % 2, tag: el.tagName.toLowerCase() });
  });
  const out = {}; let n = 0;
  const maps = mapDoc ? [...mapDoc.querySelectorAll('map')].map((m) => [m.getAttribute('value') || m.getAttribute('name'), m.getAttribute('action') || '']) : Object.keys(defs).map((k) => [k, k]);
  maps.forEach(([val, action]) => {
    if (!val) return; const list = defs[String(val).toUpperCase()]; if (!list) return;
    const am = action.match(/deck (\d|left|right|master)/i);
    list.forEach((x) => {
      let d = x.deck; if (am) d = /left/i.test(am[1]) ? 0 : /right/i.test(am[1]) ? 1 : /\d/.test(am[1]) ? (+am[1] - 1) % 2 : d;
      const a = djcGuess(action.replace(/deck \S+/i, '').trim() || val, d); if (!a || out[x.key]) return; out[x.key] = a; n++;
    });
  });
  return out;
}
function djcImport() {
  const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = '.xml,.midi.xml';
  i.onchange = async () => {
    try {
      const docs = await Promise.all([...i.files].map(async (f) => ({ f, d: new DOMParser().parseFromString(await f.text(), 'application/xml') })));
      let map = null, kind = '';
      const mix = docs.find((x) => x.d.querySelector('MixxxControllerPreset, MixxxMIDIPreset, controller controls control'));
      if (mix) { map = djcParseMixxx(mix.d); kind = 'Mixxx'; }
      else {
        const def = docs.find((x) => x.d.querySelector('[note],[cc]')), mp = docs.find((x) => x.d.querySelector('map[value],map[action]'));
        if (!def) throw new Error('нужен файл описания пульта (definition) — в нём есть note= и cc=');
        map = djcParseVdj(def.d, mp ? mp.d : null); kind = 'Virtual DJ';
      }
      const n = Object.keys(map).length; if (!n) throw new Error('не нашёл ни одной знакомой функции');
      const replace = confirm(`${kind}: найдено ${n} привязок. Заменить текущую карту? (Отмена — добавить к текущей)`);
      djcApplyMap(map, replace); toast(`Карта ${kind} загружена: ${n} привязок`, 'check'); djRender();
    } catch (e) { toast('Не удалось прочитать карту: ' + e.message, 'alert'); }
  };
  i.click();
}
function djcExport() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ pulseMidi: 1, devices: midiNames(), map: lib.midi || {}, inv: lib.midiInv || {} }, null, 1)], { type: 'application/json' })); a.download = 'pulse-midi-map.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

// ---------- обработка ручек и джога ----------
// текущее значение параметра 0..1 — для «мягкого захвата»
function djcCur(act) {
  const d = +act.slice(-1);
  if (act === 'xf') return dj.xf;
  if (act === 'master') return lib.volume / 100;
  if (/^vol[01]$/.test(act)) return djK[d].vol / 100;
  if (/^(high|mid|low)[01]$/.test(act)) { const x = djK[d][act.slice(0, -1)]; return x < 0 ? 0.5 + x / 52 : 0.5 + x / 12; }
  if (/^filter[01]$/.test(act)) return 0.5 + djK[d].filter / 200;
  if (/^pitch[01]$/.test(act)) { const r = S().dj.range || 8; return 0.5 + djK[d].pitch / (2 * r); }
  return null;
}
function djcAbs(key, act, v) {
  if (midiInv()[key]) v = 1 - v;
  if (DJC().soft && act !== 'echo' && act !== 'rev') {
    const cur = djcCur(act), c = djc.caught[act];
    if (cur != null) {
      if (!c || performance.now() - c.at > 4000) { // давно не трогали — ждём, пока ручка «поймает» текущее значение
        if (Math.abs(v - cur) > 0.09 && !(c && (c.v - cur) * (v - cur) <= 0)) { djc.caught[act] = { v, at: c ? c.at : 0, wait: true }; djcHint(act, cur, v); return null; }
      }
      djc.caught[act] = { v, at: performance.now() };
    }
  }
  return v;
}
let djcHintT = 0;
function djcHint(act, cur, v) { const now = performance.now(); if (now - djcHintT < 1500) return; djcHintT = now; toast(`«${MIDI_NAME[act] || act}»: доведи ручку ${v < cur ? 'вверх' : 'вниз'} до текущего значения`, 'tune'); }
function djcRel(key, val) {
  // джоги бывают двух типов: «вокруг 64» (Pioneer, Numark) и «дополнительный код» (1 / 127). Определяем по первым сигналам.
  let m = djc.relMode[key]; if (!m) m = djc.relMode[key] = val > 40 && val < 88 ? 'off' : 'twos';
  return m === 'off' ? val - 64 : val === 0 ? 0 : val < 64 ? val : val - 128;
}
function djcJog(d, dlt) {
  const C = DJC(), k = (C.jogSens || 100) / 100, a = decks[d]; if (!a || !a.src) return;
  if (C.jog === 'scrub') { const t = Math.max(0, a.currentTime + dlt * 0.012 * k); if (a === audio) E.seek(t); else a.currentTime = t; return; }
  if (C.jog === 'bend') { // временно ускоряем/замедляем деку, как настоящий джог
    const base = (+S().audio.speed || 1) * djRateOf(a); a.playbackRate = Math.max(0.5, Math.min(2, base * (1 + Math.max(-0.12, Math.min(0.12, dlt * 0.012 * k)))));
    clearTimeout(djc.bendT[d]); djc.bendT[d] = setTimeout(() => djSetRate(d), 140); return;
  }
  DJ.nudge(d, dlt * 0.006 * k);
}

// ---------- подсветка кнопок на пульте ----------
function djcOutputs() { const r = []; if (midi.acc) midi.acc.outputs.forEach((o) => o.state !== 'disconnected' && r.push(o)); return r; }
function djcLeds() {
  if (!DJC().led || !midi.acc) return; const outs = djcOutputs(); if (!outs.length) return;
  const names = midiNames(), same = outs.filter((o) => names.includes(o.name)); if (!same.length) return;
  const m = lib.midi || {}, beatOn = (() => { const T = tempoAt(E.time()); return T.conf && ((T.pos % 1) + 1) % 1 < 0.5; })();
  for (const k in m) {
    if (k[0] !== 'n') continue; const a = m[k], d = +a.slice(-1); let on = null;
    if (/^play[01]$/.test(a)) on = !!(decks[d] && decks[d].src && !decks[d].paused) ? 1 : 0;
    else if (a === 'play') on = playing ? 1 : 0;
    else if (/^cue[01]$/.test(a)) on = decks[d] && decks[d].paused && decks[d].src ? 1 : 0;
    else if (/^sync[01]$/.test(a)) on = decks[d] === audio && playing && beatOn ? 1 : 0;
    else if (/^loop[01]$/.test(a)) on = dj.loops[d] ? 1 : 0;
    else if (/^hot[01]_[0-3]$/.test(a)) { const t = djTrackOf(+a[3]), c = t && lib.cues && lib.cues[t.id]; on = c && c[+a[5]] != null ? 1 : 0; }
    if (on == null || djc.ledPrev[k] === on) continue; djc.ledPrev[k] = on;
    const [, ch, no] = k.split(':'); same.forEach((o) => { try { o.send([0x90 | ((+ch - 1) & 15), +no, on ? 127 : 0]); } catch {} });
  }
}

// ---------- MIDI Clock ----------
function djcClockListen() {
  if (!midi.acc) return;
  midi.acc.inputs.forEach((inp) => { if (djc.listened.has(inp.id)) return; djc.listened.add(inp.id); inp.addEventListener('midimessage', djcClockMsg); });
}
function djcClockMsg(e) {
  const b = e.data[0]; if (b < 0xf8 || !DJC().clockIn) return;
  if (b === 0xf8) {
    const t = e.timeStamp || performance.now(), q = djc.clockTicks; q.push(t); if (q.length > 49) q.shift();
    if (q.length >= 25) { const bpm = 60000 / (((q[q.length - 1] - q[0]) / (q.length - 1)) * 24); if (bpm > 40 && bpm < 300) { djc.clockBpm = djc.clockBpm ? djc.clockBpm * 0.8 + bpm * 0.2 : bpm; djc.clockAt = performance.now(); } }
  } else if (DJC().startStop && (b === 0xfa || b === 0xfb)) { if (!playing) toggle(); }
  else if (DJC().startStop && b === 0xfc) { if (playing) toggle(); }
}
let djcFollowAt = 0;
function djcFollow() {
  const C = DJC(); if (!C.clockIn || !C.follow || !djc.clockBpm || performance.now() - djc.clockAt > 2000) return;
  const now = performance.now(); if (now - djcFollowAt < 500) return; djcFollowAt = now;
  const i = djA(), an = djAnOf(i); if (!an || !an.bpm) return;
  const r = S().dj.range || 8, target = Math.max(-r, Math.min(r, (djc.clockBpm / (an.bpm * (+S().audio.speed || 1)) - 1) * 100));
  if (Math.abs(target - djK[i].pitch) > 0.05) DJ.setK(i, 'pitch', +target.toFixed(2));
}
function djcClockOut() {
  clearInterval(djc.clockOutT); djc.clockOutT = null; const id = DJC().clockOut; if (!id || !midi.acc) return;
  let wasPlaying = null;
  djc.clockOutT = setInterval(() => {
    const o = midi.acc && midi.acc.outputs.get(id); if (!o) return;
    if (playing !== wasPlaying) { try { o.send([playing ? 0xfa : 0xfc]); } catch {} wasPlaying = playing; djc.clockNext = performance.now(); }
    if (!playing) return;
    const T = tempoAt(E.time()), bpm = (T.conf ? T.bpm : 120) * ((audio && audio.playbackRate) || 1), per = 60000 / (bpm * 24), now = performance.now();
    if (djc.clockNext < now - 200) djc.clockNext = now;
    while (djc.clockNext < now + 120) { try { o.send([0xf8], djc.clockNext); } catch {} djc.clockNext += per; }
  }, 50);
}

// ---------- мастер настройки ----------
const DJC_WIZ = ['play0', 'cue0', 'sync0', 'vol0', 'high0', 'mid0', 'low0', 'filter0', 'pitch0', 'jog0', 'play1', 'cue1', 'sync1', 'vol1', 'high1', 'mid1', 'low1', 'filter1', 'pitch1', 'jog1', 'xf', 'hot0_0', 'hot0_1', 'hot1_0', 'hot1_1', 'load'];
function djcWizStep() {
  if (djc.wiz < 0) return;
  if (djc.wiz >= DJC_WIZ.length) { djc.wiz = -1; midi.learn = null; toast('Пульт настроен!', 'check'); djRender(); return; }
  midi.learn = DJC_WIZ[djc.wiz]; djRender();
}
setInterval(() => { if (djc.wiz >= 0 && !midi.learn) { djc.wiz++; djcWizStep(); } }, 200);

// ---------- интерфейс на странице «Диджей» ----------
function djcHtml() {
  const C = DJC(), outs = djcOutputs(), names = midiNames(), pre = Object.entries(DJC_PRESETS).find(([, p]) => names.some((n) => p.match.test(n)));
  const ext = C.clockIn ? (djc.clockBpm && performance.now() - djc.clockAt < 2000 ? `<span class="badge live">Внешний темп: ${djc.clockBpm.toFixed(1)} BPM</span>` : '<span class="badge dim">Жду MIDI Clock…</span>') : '';
  const sg = (k, opts) => `<div class="seg mini">${opts.map(([v, n]) => `<button class="${String(C[k]) === String(v) ? 'on' : ''}" data-djc="set" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div>`;
  const tgl = (k) => `<div class="toggle ${C[k] ? 'on' : ''}" data-djc="tg" data-k="${k}"></div>`;
  const rowH = (t, s, c) => `<div class="set-row"><div class="set-l"><b>${t}</b>${s ? `<span>${s}</span>` : ''}</div><div class="set-c">${c}</div></div>`;
  const wiz = djc.wiz >= 0 ? `<div class="djc-wiz">${ico('piano')}<div><b>Шаг ${djc.wiz + 1} из ${DJC_WIZ.length}: ${esc(PulseI18n.t(MIDI_NAME[DJC_WIZ[djc.wiz]] || ''))}</b><span>Нажми или пошевели этот элемент на пульте</span></div><button class="btn sm" data-djc="wizskip">Пропустить</button><button class="btn sm ghost" data-djc="wizstop">Стоп</button></div>` : '';
  return `<section class="set-sec dj-midi djc"><h3>${ico('dj')}Интеграция с пультом и Virtual DJ</h3>${wiz}
    ${rowH('Готовая карта', pre ? `Найден ${esc(pre[1].name)}` : 'Подключи пульт — популярные модели настраиваются сами', `<select class="sel" data-djc="preset"><option value="">Выбрать…</option>${Object.entries(DJC_PRESETS).map(([k, p]) => `<option value="${k}" ${C.preset === k ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`)}
    ${rowH('Импорт карты', 'Файлы Virtual DJ (описание пульта + mapper .xml, можно оба сразу) или Mixxx (.midi.xml) — так работает почти любой контроллер', `<button class="btn sm" data-djc="import">${ico('file')}Импорт…</button><button class="btn sm" data-djc="export">${ico('download')}Экспорт</button>`)}
    ${rowH('Мастер настройки', 'Пошагово: Pulse называет действие — ты жмёшь кнопку на пульте', `<button class="btn sm acc" data-djc="wiz">${ico('piano')}Начать</button>`)}
    ${rowH('Подсветка кнопок', 'Play, Cue, Sync, лупы и метки светятся на пульте', tgl('led'))}
    ${rowH('Мягкий захват ручек', 'Громкость и эквалайзер не прыгают, если ручка на пульте стоит в другом положении', tgl('soft'))}
    ${rowH('Джог', 'Подтолкнуть — сдвиг по времени, Притормозить — как на виниле, Перемотка — быстрый поиск', sg('jog', [['nudge', 'Подтолкнуть'], ['bend', 'Притормозить'], ['scrub', 'Перемотка']]))}
    ${rowH('Чувствительность джога', '', `<div class="rng"><input type="range" min="25" max="300" step="25" value="${C.jogSens}" data-djc-r="jogSens"><span>${C.jogSens}%</span></div>`)}
    <div class="set-grp">MIDI Clock · синхронизация с Virtual DJ</div>
    ${rowH('Отправлять темп', 'Pulse становится мастером темпа: Virtual DJ, Ableton, светомузыка идут в такт. Для связи программ на одном ПК — виртуальный порт loopMIDI', `<select class="sel" data-djc="clockOut"><option value="">Выключено</option>${outs.map((o) => `<option value="${esc(o.id)}" ${C.clockOut === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>`)}
    ${rowH('Принимать темп', 'Слушать MIDI Clock от Virtual DJ / другой программы', tgl('clockIn') + ext)}
    ${C.clockIn ? rowH('↳ Подстраивать деку в эфире', 'Темп трека в эфире догоняет внешний BPM (в пределах диапазона темпа)', tgl('follow')) + rowH('↳ Старт / стоп по клоку', 'Play и Stop из внешней программы управляют Pulse', tgl('startStop')) : ''}
  </section>`;
}
{ const base = midiHtml; midiHtml = function () { return base() + djcHtml(); }; }
document.addEventListener('click', (e) => {
  const el = e.target.closest('.dj-page [data-djc]'); if (!el) return; const d = el.dataset, C = DJC();
  if (d.djc === 'tg') { C[d.k] = !C[d.k]; el.classList.toggle('on', C[d.k]); save(); if (d.k === 'clockIn') djcClockListen(); setTimeout(djRender, 230); return; }
  if (d.djc === 'set') { C[d.k] = d.v; save(); setTimeout(djRender, 0); return; }
  if (d.djc === 'import') return djcImport();
  if (d.djc === 'export') return djcExport();
  if (d.djc === 'wiz') { if (!midi.acc) midiInit(); djc.wiz = 0; djc.wizKeys = {}; djcWizStep(); return; }
  if (d.djc === 'wizskip') { midi.learn = null; return; }
  if (d.djc === 'wizstop') { djc.wiz = -1; midi.learn = null; setTimeout(djRender, 0); }
}, true);
document.addEventListener('change', (e) => {
  const el = e.target.closest && e.target.closest('.dj-page [data-djc]'); if (!el) return; const C = DJC();
  if (el.dataset.djc === 'preset' && el.value) { const p = DJC_PRESETS[el.value]; const rep = confirm(`Подключить карту «${p.name}»? ОК — заменить текущие привязки, Отмена — добавить`); const n = djcApplyMap(p.map, rep); C.preset = el.value; save(); toast(`Карта подключена: ${n} привязок`, 'check'); djRender(); }
  if (el.dataset.djc === 'clockOut') { C.clockOut = el.value; save(); djcClockOut(); }
});
document.addEventListener('input', (e) => { const el = e.target; if (!el.dataset || !el.dataset.djcR) return; DJC()[el.dataset.djcR] = +el.value; const s = el.nextElementSibling; if (s) s.textContent = el.value + '%'; save(); });
// фоновые задачи пульта — только когда пульт реально подключён
setInterval(() => { if (!midi.acc) return; djcLeds(); djcFollow(); }, 150);
setTimeout(() => { if (!lib.midi || !Object.keys(lib.midi).length) midiInit().then(() => { djcAutoPreset(); djcClockListen(); djcClockOut(); }).catch(() => {}); else setTimeout(() => { djcClockListen(); djcClockOut(); }, 1500); }, 2500);
// после переподключения пульта — новые входы тоже слушаем
{ const base = midiBind; midiBind = function () { base(); djcClockListen(); setTimeout(djcAutoPreset, 300); }; }
