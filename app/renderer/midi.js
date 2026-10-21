'use strict';
// MIDI-контроллеры: автоопределение подключённых устройств, «обучение» (жмёшь кнопку в Pulse,
// потом крутишь ручку на пульте), карта сохраняется. Работает с любым USB-MIDI пультом.
const midi = { acc: null, err: null, learn: null, last: '', prev: {}, devs: [], on: false };
const MIDI_ACT = [
  ['g:Транспорт'], ['play', 'Плей / пауза', 'btn'], ['next', 'Следующий', 'btn'], ['prev', 'Предыдущий', 'btn'], ['mix', 'Свести (автомикс сейчас)', 'btn'], ['auto', 'Автомикс вкл/выкл', 'btn'], ['master', 'Общая громкость', 'abs'],
  ['g:Микшер'], ['xf', 'Кроссфейдер', 'abs'], ['vol0', 'Громкость деки 1', 'abs'], ['vol1', 'Громкость деки 2', 'abs'],
  ['high0', 'Верх 1', 'abs'], ['mid0', 'Середина 1', 'abs'], ['low0', 'Низ 1', 'abs'], ['filter0', 'Фильтр 1', 'abs'],
  ['high1', 'Верх 2', 'abs'], ['mid1', 'Середина 2', 'abs'], ['low1', 'Низ 2', 'abs'], ['filter1', 'Фильтр 2', 'abs'],
  ['g:Деки'], ['play0', 'Плей деки 1', 'btn'], ['play1', 'Плей деки 2', 'btn'], ['cue0', 'CUE 1', 'btn'], ['cue1', 'CUE 2', 'btn'], ['sync0', 'SYNC 1', 'btn'], ['sync1', 'SYNC 2', 'btn'],
  ['pitch0', 'Темп деки 1', 'abs'], ['pitch1', 'Темп деки 2', 'abs'], ['jog0', 'Джог 1 (подтолкнуть)', 'rel'], ['jog1', 'Джог 2 (подтолкнуть)', 'rel'],
  ['brake0', 'Тормоз 1', 'btn'], ['brake1', 'Тормоз 2', 'btn'], ['load', 'Загрузить следующий в деку', 'btn'],
  ['loop0', 'Луп 4 доли · дека 1', 'btn'], ['loop1', 'Луп 4 доли · дека 2', 'btn'],
  ['hot0_0', 'Метка 1 · дека 1', 'btn'], ['hot0_1', 'Метка 2 · дека 1', 'btn'], ['hot0_2', 'Метка 3 · дека 1', 'btn'], ['hot0_3', 'Метка 4 · дека 1', 'btn'],
  ['hot1_0', 'Метка 1 · дека 2', 'btn'], ['hot1_1', 'Метка 2 · дека 2', 'btn'], ['hot1_2', 'Метка 3 · дека 2', 'btn'], ['hot1_3', 'Метка 4 · дека 2', 'btn'],
  ['g:Эффекты'], ['echo', 'Эхо', 'abs'], ['rev', 'Реверб', 'abs'], ['viz', 'Следующий визуал', 'btn'], ['vizMode', 'Открыть визуал', 'btn']
];
const MIDI_KIND = Object.fromEntries(MIDI_ACT.filter((a) => a[1]).map((a) => [a[0], a[2]]));
const MIDI_NAME = Object.fromEntries(MIDI_ACT.filter((a) => a[1]).map((a) => [a[0], a[1]]));
const midiMap = () => (lib.midi = lib.midi || {});
async function midiInit() {
  if (midi.acc || midi.on) return; midi.on = true;
  if (!navigator.requestMIDIAccess) { midi.err = 'Web MIDI недоступен'; return; }
  try {
    midi.acc = await navigator.requestMIDIAccess({ sysex: false });
    midi.acc.onstatechange = (e) => { const p = e.port; if (p && p.type === 'input') { const was = midi.devs.includes(p.id); midiBind(); const now = midi.devs.includes(p.id); if (now && !was) toast('Подключён пульт: ' + (p.name || 'MIDI'), 'dj'); if (!now && was) toast('Пульт отключён: ' + (p.name || 'MIDI'), 'alert'); if (typeof djRender === 'function') djRender(); } };
    midiBind();
    if (midi.devs.length) toast('Найден пульт: ' + midiNames().join(', '), 'dj');
  } catch (e) { midi.err = e.message || String(e); }
}
function midiBind() {
  midi.devs = []; if (!midi.acc) return;
  midi.acc.inputs.forEach((inp) => { if (inp.state === 'disconnected') return; midi.devs.push(inp.id); inp.onmidimessage = midiMsg; });
}
const midiNames = () => { const r = []; if (midi.acc) midi.acc.inputs.forEach((i) => i.state !== 'disconnected' && r.push(i.name || 'MIDI')); return r; };
function midiMsg(e) {
  const [st, d1 = 0, d2 = 0] = e.data, ty = st & 0xf0, ch = (st & 0x0f) + 1; let key, val, press = false;
  if (ty === 0x90 || ty === 0x80) { key = `n:${ch}:${d1}`; val = ty === 0x90 ? d2 : 0; press = ty === 0x90 && d2 > 0; }
  else if (ty === 0xb0) { key = `c:${ch}:${d1}`; val = d2; press = d2 > 63 && !(midi.prev[key] > 63); }
  else if (ty === 0xe0) { key = `p:${ch}`; val = ((d2 << 7) | d1) / 128; }
  else return;
  midi.last = key + ' = ' + val;
  const m = midiMap();
  if (midi.learn) {
    // мастер/обучение: засчитываем только НАЖАТИЕ — отпускание кнопки (note-off, velocity 0, CC 0) игнорируем
    const now = performance.now(), isBtn = MIDI_KIND[midi.learn] === 'btn';
    if (ty === 0x80 || (ty === 0x90 && d2 === 0) || (isBtn && ty === 0xb0 && d2 < 64)) { midi.prev[key] = val; return; }
    if (now < (midi.learnHold || 0)) { midi.prev[key] = val; return; }
    if (typeof djc !== 'undefined' && djc.wiz >= 0) {
      djc.wizKeys = djc.wizKeys || {};
      if (djc.wizKeys[key] && djc.wizKeys[key] !== midi.learn) { midi.prev[key] = val; djc.wizAt = djc.wizAt || {}; const fresh = now - (djc.wizAt[key] || 0) < 1500; djc.wizAt[key] = now; if (!fresh && now - (midi.dupToast || 0) > 1500) { midi.dupToast = now; toast(`Эта кнопка уже занята: «${MIDI_NAME[djc.wizKeys[key]]}». Нажми другую`, 'alert'); } return; }
      djc.wizKeys[key] = midi.learn; djc.wizAt = djc.wizAt || {}; djc.wizAt[key] = now;
    }
    midi.learnHold = now + 350;
  }
  if (midi.learn) { Object.keys(m).forEach((k) => { if (k === key) delete m[k]; }); m[key] = midi.learn; toast(`«${MIDI_NAME[midi.learn]}» → ${key}`, 'check'); midi.learn = null; midi.prev[key] = val; save(); if (typeof djRender === 'function') djRender(); return; }
  const act = m[key]; midi.prev[key] = val; if (!act) return;
  const k = MIDI_KIND[act];
  if (k === 'btn') { if (press) midiDo(act, 1); }
  else if (k === 'rel') { const dlt = typeof djcRel === 'function' ? djcRel(key, val) : val === 64 ? 0 : val < 64 ? val : val - 128; if (dlt) midiDo(act, dlt); }
  else { let v = Math.max(0, Math.min(1, val / 127)); if (typeof djcAbs === 'function') { v = djcAbs(key, act, v); if (v == null) return; } midiDo(act, v); }
}
let midiRT = 0; const midiRefresh = () => { clearTimeout(midiRT); midiRT = setTimeout(() => typeof djRender === 'function' && djRender(), 120); };
function midiDo(a, v) {
  const lerp = (lo, hi) => Math.round(lo + (hi - lo) * v);
  const deck = (s) => +s.slice(-1);
  if (a === 'play') return toggle();
  if (a === 'next') return next();
  if (a === 'prev') return prev();
  if (a === 'mix') return DJ.mix();
  if (a === 'auto') { S().dj.auto = !S().dj.auto; save(); toast(S().dj.auto ? 'Автомикс включён' : 'Автомикс выключен', 'dj'); return midiRefresh(); }
  if (a === 'master') return setVolume(v * 100);
  if (a === 'xf') { DJ.xf(v); const x = $('djXf'); if (x) x.value = Math.round(v * 1000); return; }
  if (/^vol[01]$/.test(a)) { DJ.setK(deck(a), 'vol', lerp(0, 100)); return midiRefresh(); }
  if (/^(high|mid|low)[01]$/.test(a)) { const x = v < 0.5 ? -26 + v * 2 * 26 : (v - 0.5) * 2 * 6; DJ.setK(deck(a), a.slice(0, -1), Math.round(x)); return midiRefresh(); }
  if (/^filter[01]$/.test(a)) { DJ.setK(deck(a), 'filter', Math.abs(v - 0.5) < 0.03 ? 0 : lerp(-100, 100)); return midiRefresh(); }
  if (/^pitch[01]$/.test(a)) { const r = S().dj.range || 8; DJ.setK(deck(a), 'pitch', +((v - 0.5) * 2 * r).toFixed(1)); return midiRefresh(); }
  if (/^jog[01]$/.test(a)) return typeof djcJog === 'function' ? djcJog(deck(a), v) : DJ.nudge(deck(a), v * 0.006);
  if (/^play[01]$/.test(a)) { DJ.play(deck(a)); return midiRefresh(); }
  if (/^cue[01]$/.test(a)) return DJ.cue(deck(a));
  if (/^sync[01]$/.test(a)) return DJ.sync(deck(a));
  if (/^brake[01]$/.test(a)) return DJ.brake(deck(a));
  if (/^loop[01]$/.test(a)) return DJ.loop(deck(a), 4);
  if (/^hot[01]_[0-3]$/.test(a)) return DJ.hot(+a[3], +a[5]);
  if (a === 'load') return DJ.loadNext();
  if (a === 'echo' || a === 'rev') return DJ.fx(a, lerp(0, 100));
  if (a === 'viz') return cycleViz(1);
  if (a === 'vizMode') return togglePP();
}
function midiHtml() {
  if (!midi.on) setTimeout(midiInit, 0);
  const m = midiMap(), keysOf = (a) => Object.keys(m).filter((k) => m[k] === a), names = midiNames();
  const dev = midi.err ? `<span class="badge dim">${esc(midi.err)}</span>` : names.length ? names.map((n) => `<span class="badge live">${ico('check')}${esc(n)}</span>`).join('') : '<span class="badge dim">Пульт не найден — подключи USB-MIDI контроллер, он определится сам</span>';
  let h = '', grp = '';
  MIDI_ACT.forEach((x) => {
    if (!x[1]) { if (grp) h += '</div>'; grp = x[0].slice(2); h += `<div class="midi-g"><em>${grp}</em>`; return; }
    const ks = keysOf(x[0]), L = midi.learn === x[0];
    h += `<button class="midi-a ${ks.length ? 'set' : ''} ${L ? 'learn' : ''}" data-ml="${x[0]}" title="${ks.length ? 'Привязано: ' + ks.join(', ') + ' · ПКМ — отвязать' : 'Нажми и пошевели ручку/кнопку на пульте'}"><b>${x[1]}</b><span>${L ? 'жду пульт…' : ks.length ? esc(ks[0]) : '—'}</span></button>`;
  });
  if (grp) h += '</div>';
  return `<section class="set-sec dj-midi"><h3>${ico('piano')}MIDI-пульт</h3><div class="midi-dev">${dev}${midi.last ? `<span class="midi-last">Последний сигнал: ${esc(midi.last)}</span>` : ''}</div>
  <p class="midi-hint">Нажми на действие, затем пошевели ручку, фейдер или нажми кнопку на пульте — привязка сохранится. Джоги лучше вешать на «Джог», ручки — на эквалайзер и фильтр.</p>
  <div class="midi-acts">${h}</div><div class="opt-row"><button class="btn sm" data-mx="rescan">${ico('refresh')}Найти пульт</button><button class="btn sm" data-mx="clear">${ico('trash')}Стереть все привязки</button></div></section>`;
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('.dj-page [data-ml],.dj-page [data-mx]'); if (!el) return;
  if (el.dataset.ml) { midi.learn = midi.learn === el.dataset.ml ? null : el.dataset.ml; if (!midi.acc) midiInit(); }
  if (el.dataset.mx === 'rescan') { midi.acc = null; midi.on = false; midi.err = null; midiInit().then(() => djRender()); }
  if (el.dataset.mx === 'clear' && confirm('Стереть все привязки MIDI?')) { lib.midi = {}; save(); }
  setTimeout(() => typeof djRender === 'function' && djRender(), 0);
}, true);
document.addEventListener('contextmenu', (e) => { const el = e.target.closest('.dj-page [data-ml]'); if (!el) return; e.preventDefault(); const m = midiMap(); Object.keys(m).forEach((k) => m[k] === el.dataset.ml && delete m[k]); save(); djRender(); });
// пульт работает сразу после запуска, даже если страница «Диджей» не открыта
setTimeout(() => { if (lib.midi && Object.keys(lib.midi).length) midiInit(); }, 1500);
