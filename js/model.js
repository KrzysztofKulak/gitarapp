import { SEED_CHORDS, SEED_SCALES } from '../data/seed.js';
import { parseFormula, scaleTabs } from './scales.js';

export const SCHEMA_VERSION = 1;
export const CATEGORIES = { riffs: 'Riffy', licks: 'Licks', chords: 'Akordy', scales: 'Skale' };
export const CAT_KEYS = Object.keys(CATEGORIES);

export const DEFAULT_SETTINGS = {
  blockMinutes: 20,
  warmupMinutes: 3,
  targets: { riffs: 0.5, licks: 0.2, chords: 0.2, scales: 0.1 },
  recommendationWindowDays: 14,
};

const pad = (n) => String(n).padStart(2, '0');
export const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayStr = () => fmtDate(new Date());
export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

export function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function newItem(category, fields = {}) {
  return {
    id: uuid(),
    category,
    name: '',
    description: '',
    tab: '',
    tags: [],
    targetBpm: null,
    archived: false,
    createdAt: new Date().toISOString(),
    ...fields,
  };
}

export function seedItems() {
  const chords = SEED_CHORDS.map((c) =>
    newItem('chords', {
      name: c.name,
      description: c.note || '',
      tab: c.tab,
      tags: c.tags || [],
      tuning: c.tuning || 'standard',
    }),
  );
  const scales = SEED_SCALES.map((s) =>
    newItem('scales', {
      name: s.name,
      description: s.description,
      formula: s.formula,
      tab: scaleTabs('E', parseFormula(s.formula), [1, 2]),
    }),
  );
  return [...chords, ...scales];
}

export function defaultData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: structuredClone(DEFAULT_SETTINGS),
    items: seedItems(),
    sessions: [],
  };
}

// MIGRATIONS[n] podnosi dane z wersji n do n+1.
const MIGRATIONS = {
  0: (d) => ({ ...d, schemaVersion: 1 }),
};

export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('To nie jest plik postępów.');
  let d = structuredClone(raw);
  let v = Number.isInteger(d.schemaVersion) ? d.schemaVersion : 0;
  if (v > SCHEMA_VERSION) throw new Error(`Plik pochodzi z nowszej wersji aplikacji (schemaVersion ${v}).`);
  while (v < SCHEMA_VERSION) {
    d = MIGRATIONS[v](d);
    v = d.schemaVersion;
  }
  d.settings = {
    ...DEFAULT_SETTINGS,
    ...d.settings,
    targets: { ...DEFAULT_SETTINGS.targets, ...(d.settings && d.settings.targets) },
  };
  d.items = Array.isArray(d.items) ? d.items : [];
  d.sessions = Array.isArray(d.sessions) ? d.sessions : [];
  return d;
}

const EMPTY_STAT = { count: 0, last: null, bpm: [], bpmLast: null, bpmBest: null };

// Liczniki wyliczane wyłącznie z sesji. Element liczy się najwyżej raz na dzień.
export function itemIndex(data) {
  const idx = new Map();
  const sessions = [...data.sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.startedAt || '').localeCompare(b.startedAt || ''),
  );
  for (const s of sessions) {
    for (const id of s.itemIds || []) {
      let e = idx.get(id);
      if (!e) idx.set(id, (e = { days: new Set(), last: null, bpm: [] }));
      e.days.add(s.date);
      if (!e.last || s.date > e.last) e.last = s.date;
      const b = s.bpm && s.bpm[id];
      if (b > 0) e.bpm.push({ date: s.date, bpm: b });
    }
  }
  for (const e of idx.values()) {
    e.count = e.days.size;
    e.bpmLast = e.bpm.length ? e.bpm[e.bpm.length - 1].bpm : null;
    e.bpmBest = e.bpm.length ? Math.max(...e.bpm.map((p) => p.bpm)) : null;
  }
  return idx;
}

export const statOf = (idx, id) => idx.get(id) || EMPTY_STAT;

export function relDay(last, today) {
  if (!last) return 'nigdy';
  const n = daysBetween(last, today);
  if (n <= 0) return 'dziś';
  if (n === 1) return 'wczoraj';
  return `${n} dni temu`;
}
