import {
  CATEGORIES, CAT_KEYS, defaultData, migrate, newItem, todayStr, addDays, itemIndex, statOf, relDay, uuid,
} from './js/model.js';
import { recommend, minutesByCategory } from './js/recommend.js';
import { Store, idbKv } from './js/storage.js';
import { diagramSvg, verticalTab, chordNotes, parseTab, TUNINGS } from './js/chords.js';
import { scaleTab, parseFormula, NOTE_NAMES } from './js/scales.js';
import { streak, heatmap, heatLevel, staleItems } from './js/stats.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (x) => `${Math.round(x * 100)}%`;
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Kolejność ważności akordów (po tagu): podstawowe i barre, power, septymowe, sus/add, mroczne, reszta.
const CHORD_GROUPS = ['dur-moll', 'power', 'septymowe', 'sus-add', 'mroczne'];

const S = {
  data: null,
  view: 'home',
  setup: null, // 'needs-setup' | 'needs-permission' | 'error'
  setupError: '',
  cat: null,
  sort: 'oldest',
  showArchived: false,
  session: null,
  statsItem: null,
  status: { kind: 'none' },
};

const store = new Store({ kv: idbKv(), onStatus: (st) => { S.status = st; paintStatus(); } });

// ---------- start ----------

async function boot() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  const r = await store.init();
  if (r.state === 'ready') {
    S.data = r.data;
    if (store.mode === 'file') S.status = { kind: 'loaded' };
  } else {
    S.setup = r.state;
    S.setupError = r.error || '';
    S.view = 'setup';
  }
  render();
}

function commit(fn) {
  fn(S.data);
  store.scheduleSave(S.data);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

function paintStatus() {
  const el = $('#status');
  const s = S.status;
  el.className = 'chip';
  if (s.kind === 'saved') { el.textContent = `Zapisano ${hhmm(s.time)}`; el.classList.add('ok'); }
  else if (s.kind === 'saving') el.textContent = 'Zapisywanie…';
  else if (s.kind === 'error') { el.textContent = 'Błąd zapisu'; el.classList.add('err'); el.title = s.message || ''; }
  else if (s.kind === 'loaded') el.textContent = store.fileName ? `Plik: ${store.fileName}` : 'Wczytano';
  else el.textContent = '';
  const b = $('#banner');
  if (S.data && store.mode === 'local') {
    b.hidden = false;
    b.textContent = store.supported
      ? 'Tryb awaryjny: dane są tylko w localStorage tej przeglądarki. Wyeksportuj JSON albo połącz plik w Ustawieniach.'
      : 'Tryb awaryjny: ta przeglądarka nie obsługuje zapisu do pliku. Dane są w localStorage; regularnie używaj „Eksportuj JSON” w Ustawieniach.';
  } else b.hidden = true;
}

// ---------- render ----------

function render() {
  const view = $('#view');
  const hasData = !!S.data;
  $('#nav').hidden = !hasData;
  if (!hasData) view.innerHTML = renderSetup();
  else {
    if (S.view === 'session' && !S.session) S.view = 'home';
    view.innerHTML = { home: renderHome, session: renderSession, stats: renderStats, settings: renderSettings }[S.view]();
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === S.view));
    if (S.view === 'session') paintTimer();
    if (S.view === 'stats') bindStats();
  }
  paintStatus();
}

function renderSetup() {
  const sup = store.supported;
  const needsPerm = S.setup === 'needs-permission';
  return `<div class="card stack">
    <h2>Gdzie zapisywać postępy?</h2>
    ${S.setupError ? `<p class="warn">${esc(S.setupError)}</p>` : ''}
    ${needsPerm ? `<p>Plik <b>${esc(store.fileName || '')}</b> jest zapamiętany. Przeglądarka prosi o potwierdzenie dostępu.</p>
      <button class="btn primary block" data-act="setup-connect">Połącz z plikiem</button>
      <p class="muted small">Albo wybierz inny plik:</p>` : ''}
    ${sup ? `<button class="btn ${needsPerm ? '' : 'primary'} block" data-act="setup-create">Utwórz nowy plik postępów</button>
      <button class="btn block" data-act="setup-open">Otwórz istniejący plik</button>` :
      '<p class="warn">Ta przeglądarka nie obsługuje zapisu do pliku (File System Access API).</p>'}
    <button class="btn block" data-act="setup-local">Użyj trybu awaryjnego (localStorage)</button>
    <p class="muted small">Plik JSON zostaje na Twoim dysku. Zapis do pliku działa w Chrome, Edge i Operze na komputerze.
    W Firefoksie, Safari i na telefonie dostępny jest tryb awaryjny z eksportem i importem JSON.</p>
  </div>`;
}

function renderHome() {
  const d = S.data;
  const today = todayStr();
  const rec = recommend(d, today);
  const win = d.settings.recommendationWindowDays;
  const todays = d.sessions.filter((s) => s.date === today);
  const todayMin = todays.reduce((a, s) => a + s.minutes, 0);
  const weekMin = Object.values(minutesByCategory(d.sessions, 7, today)).reduce((a, b) => a + b, 0);
  const bars = CAT_KEYS.map((k) => {
    const share = rec.shares[k], target = d.settings.targets[k];
    return `<div class="bar-row"><span>${CATEGORIES[k]}</span>
      <div class="track"><div class="fill" style="width:${Math.min(100, share * 100)}%"></div><div class="target" style="left:calc(${target * 100}% - 1px)"></div></div>
      <span class="val">${pct(share)} / ${pct(target)}</span></div>`;
  }).join('');
  const sessionBanner = S.session
    ? `<div class="card row" style="justify-content:space-between"><span>Trwa sesja: <b>${CATEGORIES[S.session.cat]}</b></span><button class="btn sm primary" data-act="nav" data-view="session">Wróć</button></div>` : '';
  return `${sessionBanner}
    <section class="card rec">
      <div class="label">Zalecane teraz</div>
      <div class="big">${CATEGORIES[rec.category]}</div>
      <div class="reason">${esc(rec.reason)}</div>
      <button class="btn primary block" data-act="start-cat" data-cat="${rec.category}">Ćwicz: ${CATEGORIES[rec.category]}</button>
    </section>
    <section class="card bars"><h2>Rozkład czasu, ostatnie ${win} dni <span class="muted small">(kreska = cel)</span></h2>${bars}</section>
    <section class="card"><h2>Wybierz inną kategorię</h2>
      <div class="grid2">${CAT_KEYS.map((k) => `<button class="btn" data-act="start-cat" data-cat="${k}">${CATEGORIES[k]}</button>`).join('')}</div>
    </section>
    <section class="card"><h2>Dzisiaj</h2>
      ${todays.length ? todays.map((s) => `<div class="row" style="justify-content:space-between"><span>${s.startedAt ? hhmm(new Date(s.startedAt)) : ''} ${CATEGORIES[s.category]}</span><span class="muted">${s.minutes} min · ${s.itemIds.length} el.</span></div>`).join('') : '<p class="muted">Jeszcze nic dzisiaj.</p>'}
      <p class="muted small" style="margin-bottom:0">Dzisiaj: <b>${todayMin} min</b> · Ostatnie 7 dni: <b>${weekMin} min</b></p>
    </section>`;
}

// ---------- sesja ----------

function startSession(cat) {
  if (S.session && S.session.cat !== cat) {
    if (!confirm('Trwa inna sesja. Porzucić ją i zacząć nową?')) return;
    stopTick();
    S.session = null;
  }
  if (!S.session) {
    const st = S.data.settings;
    S.session = {
      cat, checked: new Set(), bpm: {}, notes: '', manual: '', startedAt: null, query: '',
      blockMin: st.blockMinutes, warmMin: st.warmupMinutes,
      timer: { phase: 'idle', remaining: 0, endAt: null, running: false, worked: 0 },
    };
    S.sort = cat === 'chords' ? 'relevance' : 'oldest';
    S.showArchived = false;
  }
  S.cat = cat;
  S.view = 'session';
  render();
  window.scrollTo(0, 0);
}

let tickId = null;
let audio = null;
const stopTick = () => { clearInterval(tickId); tickId = null; };

function beep(long) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const now = audio.currentTime;
    const n = long ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = long ? 880 : 660;
      o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, now + i * 0.3);
      g.gain.exponentialRampToValueAtTime(0.4, now + i * 0.3 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.3 + 0.25);
      o.start(now + i * 0.3); o.stop(now + i * 0.3 + 0.28);
    }
    navigator.vibrate?.(long ? [200, 100, 200, 100, 400] : 200);
  } catch { /* brak audio */ }
}

const mainSecs = (s) => Math.max(1, Math.round(s.blockMin * 60));

function timerStart() {
  const s = S.session, t = s.timer;
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* ignore */ }
  if (t.phase === 'idle' || t.phase === 'done') {
    s.startedAt = s.startedAt || new Date().toISOString();
    t.worked = 0;
    if (s.warmMin > 0) { t.phase = 'warmup'; t.remaining = Math.round(s.warmMin * 60); }
    else { t.phase = 'main'; t.remaining = mainSecs(s); }
  }
  t.running = true;
  t.endAt = Date.now() + t.remaining * 1000;
  stopTick();
  tickId = setInterval(tick, 250);
  paintTimer();
}

function timerPause() {
  tick();
  const t = S.session.timer;
  t.running = false;
  stopTick();
  paintTimer();
}

function tick() {
  const s = S.session;
  if (!s) return stopTick();
  const t = s.timer;
  if (!t.running) return;
  t.remaining = Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000));
  if (t.phase === 'main') t.worked = mainSecs(s) - t.remaining;
  if (t.remaining === 0) {
    if (t.phase === 'warmup') {
      t.phase = 'main'; t.remaining = mainSecs(s); t.endAt = Date.now() + t.remaining * 1000;
      beep(false);
    } else {
      t.phase = 'done'; t.running = false; t.worked = mainSecs(s);
      stopTick();
      beep(true);
    }
  }
  paintTimer();
}

function timerReset() {
  stopTick();
  S.session.timer = { phase: 'idle', remaining: 0, endAt: null, running: false, worked: 0 };
  render();
}

function skipWarmup() {
  const s = S.session, t = s.timer;
  if (t.phase === 'warmup') {
    t.phase = 'main'; t.remaining = mainSecs(s);
    if (t.running) t.endAt = Date.now() + t.remaining * 1000;
  } else if (t.phase === 'idle') s.warmMin = 0;
  render();
}

function paintTimer() {
  const s = S.session;
  const el = $('#timer');
  if (!s || !el) return;
  const t = s.timer;
  const secs = t.phase === 'idle' ? (s.warmMin > 0 ? Math.round(s.warmMin * 60) : mainSecs(s)) : t.remaining;
  const label = { idle: s.warmMin > 0 ? 'Rozgrzewka' : 'Gotowy', warmup: 'Rozgrzewka', main: 'Ćwiczenie', done: 'Koniec bloku' }[t.phase];
  el.className = `card timer ${t.phase === 'warmup' || (t.phase === 'idle' && s.warmMin > 0) ? 'warm' : ''} ${t.phase === 'done' ? 'done' : ''}`;
  $('.phase', el).textContent = label;
  $('.time', el).textContent = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const go = $('[data-act="timer-toggle"]', el);
  go.textContent = t.running ? 'Pauza' : t.phase === 'idle' || t.phase === 'done' ? 'Start' : 'Wznów';
  const skip = $('[data-act="skip-warm"]', el);
  skip.hidden = !(t.phase === 'warmup' || (t.phase === 'idle' && s.warmMin > 0));
}

function sortedItems(cat, idx) {
  const q = (S.session?.query || '').toLowerCase();
  const list = S.data.items.filter((it) => it.category === cat && (S.showArchived ? true : !it.archived));
  const pos = new Map(S.data.items.map((it, i) => [it.id, i]));
  const rank = (it) => {
    const r = CHORD_GROUPS.findIndex((g) => (it.tags || []).includes(g));
    return r < 0 ? CHORD_GROUPS.length : r;
  };
  const by = {
    relevance: (a, b) => rank(a) - rank(b) || pos.get(a.id) - pos.get(b.id),
    oldest: (a, b) => {
      const la = statOf(idx, a.id).last, lb = statOf(idx, b.id).last;
      if (la === lb) return a.name.localeCompare(b.name, 'pl');
      if (!la) return -1;
      if (!lb) return 1;
      return la.localeCompare(lb);
    },
    alpha: (a, b) => a.name.localeCompare(b.name, 'pl'),
    count: (a, b) => statOf(idx, b.id).count - statOf(idx, a.id).count || a.name.localeCompare(b.name, 'pl'),
  }[S.sort];
  return list.sort(by).map((it) => ({ it, hidden: q && !(`${it.name} ${(it.tags || []).join(' ')}`.toLowerCase().includes(q)) }));
}

function itemDetail(it) {
  let h = '';
  if (it.category === 'chords') {
    const tuning = it.tuning || 'standard';
    h += `<div class="chordbox">${diagramSvg(it.tab)}<pre class="tab">${esc(verticalTab(it.tab, tuning))}</pre></div>`;
    h += `<div class="muted small">Dźwięki: ${chordNotes(it.tab, tuning).join(' ')}${tuning !== 'standard' ? ` · <b class="warn">${TUNINGS[tuning].label}</b>` : ''}</div>`;
  } else if (it.tab) h += `<pre class="tab">${esc(it.tab)}</pre>`;
  if (it.category === 'scales' && it.formula) h += `<div class="small">Wzór: <b>${esc(it.formula)}</b></div>`;
  if (it.description) h += `<div style="white-space:pre-wrap">${esc(it.description)}</div>`;
  if (it.targetBpm) h += `<div class="small">Docelowe BPM: <b>${it.targetBpm}</b></div>`;
  h += `<div class="row"><button class="btn sm" data-act="edit" data-id="${it.id}">Edytuj</button>
    <button class="btn sm" data-act="archive" data-id="${it.id}">${it.archived ? 'Przywróć' : 'Archiwizuj'}</button></div>`;
  return h;
}

function renderSession() {
  const s = S.session, cat = s.cat;
  const idx = itemIndex(S.data);
  const today = todayStr();
  const rows = sortedItems(cat, idx).map(({ it, hidden }) => {
    const st = statOf(idx, it.id);
    const checked = s.checked.has(it.id);
    const meta = [`×${st.count}`, `ostatnio: ${relDay(st.last, today)}`, st.bpmLast ? `BPM ${st.bpmLast} (max ${st.bpmBest})` : ''].filter(Boolean).join(' · ');
    return `<li class="item ${checked ? 'checked' : ''} ${it.archived ? 'archived' : ''}" data-id="${it.id}" ${hidden ? 'hidden' : ''} data-q="${esc((it.name + ' ' + (it.tags || []).join(' ')).toLowerCase())}">
      <div class="item-head">
        <input type="checkbox" data-id="${it.id}" aria-label="Ćwiczone dzisiaj: ${esc(it.name)}" ${checked ? 'checked' : ''}>
        <div><div class="item-name">${esc(it.name)}${it.archived ? ' <span class="tag">archiwum</span>' : ''}</div>
          <div class="item-meta">${esc(meta)}${it.category === 'chords' ? ` · <span style="font-family:var(--mono)">${esc(it.tab)}</span>` : ''}</div></div>
        <input class="bpm" type="number" inputmode="numeric" min="20" max="400" placeholder="BPM" data-bpm="${it.id}" value="${s.bpm[it.id] ?? ''}" aria-label="BPM: ${esc(it.name)}">
      </div>
      <details class="more" ${cat === 'chords' ? 'open' : ''}><summary>Szczegóły</summary><div class="more-body">${itemDetail(it)}</div></details>
    </li>`;
  }).join('');
  return `<div class="row" style="justify-content:space-between;margin-bottom:10px"><h2 style="margin:0">${CATEGORIES[cat]}</h2>
      <button class="btn sm danger" data-act="discard-session">Porzuć sesję</button></div>
    <section id="timer" class="card timer"><div class="phase"></div><div class="time">00:00</div>
      <div class="row" style="justify-content:center;margin:10px 0">
        <button class="btn primary" style="min-width:130px" data-act="timer-toggle">Start</button>
        <button class="btn" data-act="skip-warm">Pomiń rozgrzewkę</button>
        <button class="btn" data-act="timer-reset">Reset</button>
      </div>
      <div class="inline-fields" style="text-align:left">
        <label class="field">Rozgrzewka (min)<input type="number" min="0" max="60" inputmode="numeric" id="warmMin" value="${s.warmMin}"></label>
        <label class="field">Blok (min)<input type="number" min="1" max="240" inputmode="numeric" id="blockMin" value="${s.blockMin}"></label>
        <label class="field">Minuty ręcznie<input type="number" min="1" max="600" inputmode="numeric" id="manualMin" placeholder="opcjonalnie" value="${esc(s.manual)}"></label>
      </div>
      <p class="muted small" style="margin:8px 0 0">Do statystyk liczy się czas bloku (bez rozgrzewki), chyba że wpiszesz minuty ręcznie.</p>
    </section>
    <div class="toolbar">
      <input class="search field" style="grid-column:1/-1;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-height:46px" type="search" id="q" placeholder="Szukaj (nazwa lub tag)…" value="${esc(s.query)}">
      <label class="field">Sortowanie<select id="sort">
        ${cat === 'chords' ? `<option value="relevance" ${S.sort === 'relevance' ? 'selected' : ''}>Ważność (podstawowe najpierw)</option>` : ''}
        <option value="oldest" ${S.sort === 'oldest' ? 'selected' : ''}>Najdawniej ćwiczone</option>
        <option value="alpha" ${S.sort === 'alpha' ? 'selected' : ''}>Alfabetycznie</option>
        <option value="count" ${S.sort === 'count' ? 'selected' : ''}>Po liczniku</option></select></label>
      <label class="field">Archiwum<select id="arch"><option value="0" ${S.showArchived ? '' : 'selected'}>Ukryj</option><option value="1" ${S.showArchived ? 'selected' : ''}>Pokaż</option></select></label>
    </div>
    <button class="btn block" data-act="add" style="margin-bottom:12px">+ Dodaj</button>
    <ul class="items" id="items">${rows || '<p class="muted">Lista jest pusta. Dodaj pierwszy element.</p>'}</ul>
    <section class="card"><label class="field">Notatki z sesji<textarea id="notes" placeholder="Co poszło dobrze, nad czym wrócić…">${esc(s.notes)}</textarea></label></section>
    <button class="btn primary block" data-act="finish">Zakończ sesję</button>`;
}

function finishSession() {
  const s = S.session;
  tick();
  const manual = Number(s.manual);
  const minutes = manual > 0 ? Math.round(manual) : Math.round(s.timer.worked / 60);
  if (minutes <= 0) return alert('Uruchom timer na blok albo wpisz liczbę minut ręcznie.');
  for (const id of Object.keys(s.bpm)) if (s.bpm[id] > 0) s.checked.add(id);
  if (!s.checked.size && !confirm('Nie zaznaczono żadnego elementu. Zapisać samą sesję?')) return;
  const itemIds = [...s.checked];
  const bpm = {};
  for (const id of itemIds) if (s.bpm[id] > 0) bpm[id] = s.bpm[id];
  const session = { id: uuid(), date: todayStr(), startedAt: s.startedAt || new Date().toISOString(), category: s.cat, minutes, itemIds, bpm, notes: s.notes.trim() };
  commit((d) => d.sessions.push(session));
  stopTick();
  S.session = null;
  S.view = 'home';
  render();
  window.scrollTo(0, 0);
  toast(`Zapisano sesję: ${minutes} min`);
}

// ---------- dodawanie / edycja ----------

function openItemDialog(id) {
  const cat = S.session?.cat || S.cat;
  const it = id ? S.data.items.find((x) => x.id === id) : null;
  const c = it ? it.category : cat;
  const v = it || { name: '', description: '', tab: '', tags: [], targetBpm: '', formula: '', tuning: 'standard' };
  const dlg = $('#dlg');
  const scaleCtl = c === 'scales' ? `<div class="card" style="margin:0"><div class="inline-fields">
      <label class="field">Dźwięk podstawowy<select id="gRoot">${NOTE_NAMES.map((n) => `<option ${n === 'E' ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field">Pozycja<select id="gPos">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<option>${n}</option>`).join('')}</select></label>
      <label class="field">Oktawa<select id="gHigh"><option value="0">od progu 0</option><option value="1">od 12. progu</option></select></label></div>
      <button type="button" class="btn sm" id="gGen" style="margin-top:10px">Generuj tab</button></div>` : '';
  dlg.innerHTML = `<form method="dialog" class="stack" id="itemForm">
    <h2>${it ? 'Edytuj' : 'Dodaj'}: ${CATEGORIES[c]}</h2>
    <label class="field">Nazwa<input name="name" required value="${esc(v.name)}"></label>
    ${c === 'scales' ? `<label class="field">Wzór interwałów (np. 1 ♭3 4 5 ♭7)<input name="formula" value="${esc(v.formula || '')}"></label>` : ''}
    ${c === 'chords' ? `<label class="field">Tab: 6 znaków od niskiej E do wysokiej e (np. x32010)<input name="tab" id="chordTab" value="${esc(v.tab)}" style="font-family:var(--mono)"></label>
      <div class="chordbox" id="chordPrev">${diagramSvg(v.tab)}</div>
      <label class="field">Strój<select name="tuning">${Object.entries(TUNINGS).map(([k, t]) => `<option value="${k}" ${(v.tuning || 'standard') === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select></label>` : ''}
    <label class="field">Opis<textarea name="description">${esc(v.description)}</textarea></label>
    ${c !== 'chords' ? `${scaleCtl}<label class="field">Tab (ASCII, opcjonalnie)<textarea name="tab" class="mono" id="tabText" rows="7" style="white-space:pre">${esc(v.tab)}</textarea></label>` : ''}
    <div class="inline-fields">
      <label class="field">Tagi (po przecinku)<input name="tags" value="${esc((v.tags || []).join(', '))}"></label>
      <label class="field">Docelowe BPM<input name="targetBpm" type="number" min="20" max="400" inputmode="numeric" value="${v.targetBpm ?? ''}"></label>
    </div>
    <div class="row"><button class="btn primary" value="ok">Zapisz</button><button class="btn" value="cancel" formnovalidate>Anuluj</button>
      ${it ? '<button type="button" class="btn danger" id="hardDel">Usuń trwale</button>' : ''}</div>
  </form>`;
  const form = $('#itemForm', dlg);
  const prev = $('#chordPrev', dlg);
  if (prev) $('#chordTab', dlg).addEventListener('input', (e) => { prev.innerHTML = diagramSvg(e.target.value) || '<span class="warn">Nieprawidłowy tab</span>'; });
  const gen = $('#gGen', dlg);
  if (gen) gen.addEventListener('click', () => {
    const iv = parseFormula(form.formula.value);
    if (!iv) return alert('Wpisz poprawny wzór interwałów, np. 1 ♭3 4 5 ♭7.');
    $('#tabText', dlg).value = scaleTab($('#gRoot', dlg).value, iv, Number($('#gPos', dlg).value), { high: $('#gHigh', dlg).value === '1' });
  });
  const del = $('#hardDel', dlg);
  if (del) del.addEventListener('click', () => {
    if (!confirm(`Usunąć „${it.name}” trwale? Sesje zachowają zapis, ale element zniknie. Tego nie da się cofnąć.`)) return;
    commit((d) => { d.items = d.items.filter((x) => x.id !== it.id); });
    dlg.close();
    render();
  });
  form.addEventListener('submit', (e) => {
    if (e.submitter?.value !== 'ok') return;
    const f = new FormData(form);
    const name = String(f.get('name')).trim();
    const tab = String(f.get('tab') ?? '').replace(/\s+$/, '');
    if (!name) { e.preventDefault(); return; }
    if (c === 'chords' && !parseTab(tab)) { e.preventDefault(); return alert('Tab akordu musi mieć 6 znaków, np. x32010 (x = struna wyciszona).'); }
    const formula = String(f.get('formula') ?? '').trim();
    if (c === 'scales' && formula && !parseFormula(formula)) { e.preventDefault(); return alert('Niepoprawny wzór interwałów.'); }
    const fields = {
      name, tab,
      description: String(f.get('description')).trim(),
      tags: String(f.get('tags')).split(',').map((t) => t.trim()).filter(Boolean),
      targetBpm: Number(f.get('targetBpm')) > 0 ? Number(f.get('targetBpm')) : null,
    };
    if (c === 'scales') fields.formula = formula;
    if (c === 'chords') fields.tuning = String(f.get('tuning'));
    commit((d) => {
      if (it) Object.assign(d.items.find((x) => x.id === it.id), fields);
      else d.items.push(newItem(c, fields));
    });
    if (!it && S.session) S.session.query = '';
    setTimeout(render, 0);
  });
  dlg.showModal();
}

// ---------- statystyki ----------

function bpmChart(points, target) {
  if (!points.length) return '<p class="muted">Brak zapisanych wartości BPM.</p>';
  const W = 320, H = 150, L = 34, R = 10, T = 10, B = 22;
  const vals = points.map((p) => p.bpm).concat(target ? [target] : []);
  const lo = Math.min(...vals) - 5, hi = Math.max(...vals) + 5;
  const x = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const y = (b) => T + (1 - (b - lo) / (hi - lo)) * (H - T - B);
  const line = points.map((p, i) => `${x(i)},${y(p.bpm)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Historia BPM">
    <line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="var(--line)"/><line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="var(--line)"/>
    ${target ? `<line x1="${L}" y1="${y(target)}" x2="${W - R}" y2="${y(target)}" stroke="var(--ok)" stroke-dasharray="4 3"/><text x="${W - R}" y="${y(target) - 3}" text-anchor="end">cel ${target}</text>` : ''}
    <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2"/>
    ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.bpm)}" r="3.5" fill="currentColor"><title>${p.date}: ${p.bpm} BPM</title></circle>`).join('')}
    <text x="${L - 4}" y="${T + 8}" text-anchor="end">${hi}</text><text x="${L - 4}" y="${H - B}" text-anchor="end">${lo}</text>
    <text x="${L}" y="${H - 6}">${points[0].date.slice(5)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${points[points.length - 1].date.slice(5)}</text></svg>`;
}

function renderStats() {
  const d = S.data, today = todayStr(), idx = itemIndex(d);
  const ranges = [['7 dni', 7], ['30 dni', 30], ['Całość', null]].map(([label, days]) => ({ label, m: minutesByCategory(d.sessions, days, today) }));
  const rowsHtml = CAT_KEYS.map((k) => `<tr><td>${CATEGORIES[k]}</td><td>${pct(d.settings.targets[k])}</td>${ranges.map((r) => {
    const tot = Object.values(r.m).reduce((a, b) => a + b, 0);
    return `<td>${r.m[k]} min<br><span class="muted small">${tot ? pct(r.m[k] / tot) : '–'}</span></td>`;
  }).join('')}</tr>`).join('');
  const totals = ranges.map((r) => `<td>${Object.values(r.m).reduce((a, b) => a + b, 0)} min</td>`).join('');
  const cells = heatmap(d.sessions, today, 12);
  const withBpm = d.items.filter((it) => statOf(idx, it.id).bpm.length);
  if (!S.statsItem || !withBpm.some((i) => i.id === S.statsItem)) S.statsItem = withBpm[0]?.id || null;
  const sel = d.items.find((i) => i.id === S.statsItem);
  const stale = staleItems(d, idx, 10);
  return `<section class="card"><h2>Minuty na kategorię</h2>
      <table class="t"><thead><tr><th></th><th>Cel</th>${ranges.map((r) => `<th>${r.label}</th>`).join('')}</tr></thead><tbody>${rowsHtml}
      <tr><td><b>Razem</b></td><td></td>${totals}</tr></tbody></table></section>
    <section class="card"><h2>Seria: ${streak(d.sessions, today)} ${streak(d.sessions, today) === 1 ? 'dzień' : 'dni'} z rzędu</h2>
      <div class="heat" aria-label="Kalendarz ćwiczeń, 12 tygodni">${cells.map((c) => `<i class="${c.future ? 'future' : 'l' + heatLevel(c.minutes)}" title="${c.date}: ${c.minutes} min"></i>`).join('')}</div>
      <p class="muted small" style="margin-bottom:0">Ostatnie 12 tygodni, od poniedziałku. Jaśniej = więcej minut.</p></section>
    <section class="card"><h2>Historia BPM</h2>
      ${withBpm.length ? `<label class="field">Element<select id="bpmItem">${withBpm.map((i) => `<option value="${i.id}" ${i.id === S.statsItem ? 'selected' : ''}>${esc(i.name)} (${CATEGORIES[i.category]})</option>`).join('')}</select></label>
      <div id="bpmChart" style="margin-top:10px">${bpmChart(statOf(idx, sel.id).bpm, sel.targetBpm)}</div>` : '<p class="muted">Zapisz BPM przy elemencie w sesji, a pojawi się tu wykres.</p>'}</section>
    <section class="card"><h2>Najdawniej niećwiczone</h2>
      ${stale.map(({ item, last }) => `<div class="row" style="justify-content:space-between;padding:4px 0"><span>${esc(item.name)} <span class="tag">${CATEGORIES[item.category]}</span></span><span class="muted">${relDay(last, today)}</span></div>`).join('') || '<p class="muted">Brak elementów.</p>'}
    </section>`;
}

function bindStats() {
  const sel = $('#bpmItem');
  if (!sel) return;
  sel.addEventListener('change', () => {
    S.statsItem = sel.value;
    const it = S.data.items.find((i) => i.id === sel.value);
    $('#bpmChart').innerHTML = bpmChart(statOf(itemIndex(S.data), it.id).bpm, it.targetBpm);
  });
}

// ---------- ustawienia ----------

function renderSettings() {
  const st = S.data.settings;
  const fileMode = store.mode === 'file';
  return `<section class="card stack"><h2>Ćwiczenie</h2>
      <div class="inline-fields">
        <label class="field">Blok (min)<input id="sBlock" type="number" min="1" max="240" value="${st.blockMinutes}"></label>
        <label class="field">Rozgrzewka (min)<input id="sWarm" type="number" min="0" max="60" value="${st.warmupMinutes}"></label>
        <label class="field">Okno rekomendacji (dni)<input id="sWin" type="number" min="1" max="365" value="${st.recommendationWindowDays}"></label></div>
      <h2 style="margin-top:6px">Docelowy rozkład czasu (%, suma = 100)</h2>
      <div class="inline-fields">${CAT_KEYS.map((k) => `<label class="field">${CATEGORIES[k]}<input data-target="${k}" type="number" min="0" max="100" value="${Math.round(st.targets[k] * 100)}"></label>`).join('')}</div>
      <button class="btn primary" data-act="save-settings">Zapisz ustawienia</button>
      <button class="btn" data-act="test-sound">Test dźwięku</button></section>
    <section class="card stack"><h2>Dane</h2>
      <p class="muted small">Tryb: <b>${fileMode ? `plik ${esc(store.fileName || '')}` : 'awaryjny (localStorage)'}</b>. Sesji: ${S.data.sessions.length}, elementów: ${S.data.items.length}.</p>
      <div class="grid2"><button class="btn" data-act="export">Eksportuj JSON</button><button class="btn" data-act="import">Importuj JSON</button></div>
      ${store.supported ? `<div class="grid2"><button class="btn" data-act="file-create">${fileMode ? 'Zapisz do nowego pliku' : 'Utwórz plik z tych danych'}</button><button class="btn" data-act="file-open">Otwórz inny plik</button></div>
        ${fileMode ? '<button class="btn danger" data-act="file-disconnect">Rozłącz plik (przejdź na localStorage)</button>' : ''}` : ''}
    </section>`;
}

function saveSettings() {
  const num = (id) => Number($(id).value);
  const targets = {};
  let sum = 0;
  document.querySelectorAll('[data-target]').forEach((i) => { targets[i.dataset.target] = Number(i.value) / 100; sum += Number(i.value); });
  if (Math.round(sum) !== 100) return alert(`Suma celów to ${sum}%, a musi wynosić 100%.`);
  const block = num('#sBlock'), warm = num('#sWarm'), win = num('#sWin');
  if (!(block >= 1) || !(warm >= 0) || !(win >= 1)) return alert('Sprawdź wartości: blok i okno min. 1, rozgrzewka min. 0.');
  commit((d) => { d.settings = { ...d.settings, blockMinutes: block, warmupMinutes: warm, recommendationWindowDays: win, targets }; });
  toast('Zapisano ustawienia');
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function guarded(fn) {
  try {
    await fn();
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    alert(e.message || String(e));
  }
}

function adopt(data, msg) {
  S.data = data;
  S.setup = null;
  S.view = 'home';
  S.status = store.mode === 'file' ? { kind: 'loaded' } : { kind: 'none' };
  render();
  if (msg) toast(msg);
}

// ---------- zdarzenia ----------

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  switch (act) {
    case 'nav':
      if (el.dataset.view === 'session' && !S.session) { S.view = 'home'; toast('Wybierz kategorię, żeby zacząć sesję'); }
      else S.view = el.dataset.view;
      render(); window.scrollTo(0, 0); break;
    case 'start-cat': startSession(el.dataset.cat); break;
    case 'timer-toggle': S.session.timer.running ? timerPause() : timerStart(); break;
    case 'timer-reset': timerReset(); break;
    case 'skip-warm': skipWarmup(); break;
    case 'finish': finishSession(); break;
    case 'discard-session':
      if (confirm('Porzucić tę sesję bez zapisu?')) { stopTick(); S.session = null; S.view = 'home'; render(); }
      break;
    case 'add': openItemDialog(null); break;
    case 'edit': openItemDialog(id); break;
    case 'archive':
      commit((d) => { const it = d.items.find((x) => x.id === id); it.archived = !it.archived; });
      render(); break;
    case 'save-settings': saveSettings(); break;
    case 'test-sound': beep(true); break;
    case 'export': download(`gitara-postepy-${todayStr()}.json`, JSON.stringify(S.data, null, 2)); break;
    case 'import': $('#importFile').click(); break;
    case 'setup-create': guarded(async () => adopt(await store.createFile(defaultData()), 'Utworzono plik')); break;
    case 'setup-open': guarded(async () => adopt(await store.openFile(), 'Otwarto plik')); break;
    case 'setup-connect': guarded(async () => adopt(await store.connect(), 'Połączono z plikiem')); break;
    case 'setup-local': guarded(async () => adopt(store.useLocal(defaultData()))); break;
    case 'file-create': guarded(async () => { await store.createFile(S.data); S.status = { kind: 'loaded' }; render(); toast('Dane zapisane w nowym pliku'); }); break;
    case 'file-open':
      guarded(async () => {
        if (!confirm('Dane z wybranego pliku zastąpią te w aplikacji. Kontynuować?')) return;
        adopt(await store.openFile(), 'Otwarto plik');
      });
      break;
    case 'file-disconnect':
      guarded(async () => { await store.disconnect(); store.useLocal(S.data); render(); toast('Rozłączono plik'); });
      break;
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'importFile') {
    const file = t.files[0];
    t.value = '';
    if (!file) return;
    file.text().then((txt) => {
      try {
        const data = migrate(JSON.parse(txt));
        if (!confirm(`Zaimportować ${data.sessions.length} sesji i ${data.items.length} elementów? Zastąpi to obecne dane.`)) return;
        S.data = data;
        store.scheduleSave(data);
        S.view = 'home';
        render();
        toast('Zaimportowano');
      } catch (err) { alert(`Import nieudany: ${err.message}`); }
    });
    return;
  }
  const s = S.session;
  if (!s) return;
  if (t.matches('li.item input[type=checkbox]')) {
    t.checked ? s.checked.add(t.dataset.id) : s.checked.delete(t.dataset.id);
    t.closest('li').classList.toggle('checked', t.checked);
  } else if (t.id === 'sort') { S.sort = t.value; render(); }
  else if (t.id === 'arch') { S.showArchived = t.value === '1'; render(); }
  else if (t.id === 'warmMin' || t.id === 'blockMin') {
    const v = Number(t.value);
    if (t.id === 'warmMin') s.warmMin = v >= 0 ? v : 0; else s.blockMin = v >= 1 ? v : 1;
    paintTimer();
  }
});

document.addEventListener('input', (e) => {
  const t = e.target, s = S.session;
  if (!s) return;
  if (t.dataset.bpm) {
    const v = Number(t.value);
    if (v > 0) {
      s.bpm[t.dataset.bpm] = v;
      s.checked.add(t.dataset.bpm);
      const li = t.closest('li');
      li.classList.add('checked');
      li.querySelector('input[type=checkbox]').checked = true;
    } else delete s.bpm[t.dataset.bpm];
  } else if (t.id === 'notes') s.notes = t.value;
  else if (t.id === 'manualMin') s.manual = t.value;
  else if (t.id === 'q') {
    s.query = t.value;
    const q = t.value.toLowerCase();
    document.querySelectorAll('#items li.item').forEach((li) => { li.hidden = !!q && !li.dataset.q.includes(q); });
  }
});

window.addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) store.flush(); });
window.addEventListener('beforeunload', (e) => {
  if (store.pending || S.status.kind === 'saving') e.preventDefault();
});

boot();
