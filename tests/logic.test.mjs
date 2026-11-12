import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_CHORDS } from '../data/seed.js';
import { verifyChord, parseTab, verticalTab, diagramSvg } from '../js/chords.js';
import { scaleTab, parseFormula, scaleFrets } from '../js/scales.js';
import { defaultData, migrate, itemIndex, statOf, SCHEMA_VERSION } from '../js/model.js';
import { recommend } from '../js/recommend.js';
import { streak, heatmap, staleItems } from '../js/stats.js';

test('wszystkie akordy startowe pasują do nazw', () => {
  assert.equal(SEED_CHORDS.length, 50);
  for (const c of SEED_CHORDS) assert.deepEqual(verifyChord(c).problems, [], c.name);
});

test('weryfikator wykrywa błędny chwyt', () => {
  assert.equal(verifyChord({ name: 'C', tab: 'x32013', root: 'C', type: 'maj' }).ok, true);
  assert.equal(verifyChord({ name: 'C', tab: 'x32011', root: 'C', type: 'maj' }).ok, false);
  assert.equal(verifyChord({ name: 'Am', tab: 'x02220', root: 'A', type: 'm' }).ok, false);
});

test('parseTab i tab pionowy', () => {
  assert.deepEqual(parseTab('x32010'), [null, 3, 2, 0, 1, 0]);
  assert.equal(parseTab('x3201'), null);
  assert.deepEqual(parseTab('x,10,12,12,12,10'), [null, 10, 12, 12, 12, 10]);
  assert.equal(verticalTab('x32010').split('\n')[5], 'E|-x-|');
  assert.match(diagramSvg('x32010'), /<svg/);
});

test('pentatonika molowa E, pozycja 1 to box z progów 0-3 / 0-2', () => {
  const rows = scaleFrets('E', parseFormula('1 ♭3 4 5 ♭7'), 1);
  assert.deepEqual(rows, [[0, 3], [0, 2], [0, 2], [0, 2], [0, 3], [0, 3]]);
});

test('eolska E: 3 nuty na strunę, e-moll w pozycji otwartej', () => {
  const rows = scaleFrets('E', parseFormula('1 2 ♭3 4 5 ♭6 ♭7'), 1);
  assert.deepEqual(rows, [[0, 2, 3], [0, 2, 3], [0, 2, 4], [0, 2, 4], [1, 3, 5], [2, 3, 5]]);
});

test('generator daje ten sam wzór od 12. progu i nie schodzi poniżej zera', () => {
  const iv = parseFormula('1 ♭3 4 5 ♭7');
  assert.deepEqual(scaleFrets('E', iv, 1, { high: true })[0], [12, 15]);
  for (const f of ['1 ♭2 ♭3 3 ♯4 5 6 ♭7', '1 2 ♭3 ♯4 5 ♭6 7', '1 ♭2 ♭3 4 ♭5 ♭6 ♭7']) {
    const intervals = parseFormula(f);
    for (let root = 0; root < 12; root++)
      for (let pos = 1; pos <= intervals.length; pos++)
        assert.ok(Math.min(...scaleFrets(root, intervals, pos).flat()) >= 0, `${f} root ${root} pos ${pos}`);
  }
  assert.equal(scaleTab('A', iv, 1).split('\n').length, 6);
});

test('parseFormula', () => {
  assert.deepEqual(parseFormula('1 ♭2 ♭3 3 ♯4 5 6 ♭7'), [0, 1, 3, 4, 6, 7, 9, 10]);
  assert.equal(parseFormula('♭3 5'), null);
  assert.equal(parseFormula('abc'), null);
});

test('dane startowe: 50 akordów, 10 skal z tabem, migracja', () => {
  const d = defaultData();
  assert.equal(d.items.filter((i) => i.category === 'chords').length, 50);
  const scales = d.items.filter((i) => i.category === 'scales');
  assert.equal(scales.length, 10);
  assert.ok(scales.every((s) => s.tab.includes('Pozycja 1') && s.tab.includes('Pozycja 2')));
  assert.equal(migrate({ items: [], sessions: [] }).schemaVersion, SCHEMA_VERSION);
  assert.throws(() => migrate({ schemaVersion: 99 }), /nowszej/);
  assert.throws(() => migrate([]));
});

const sess = (date, category, minutes, itemIds = [], bpm = {}) => ({ id: date + category, date, startedAt: date + 'T10:00:00', category, minutes, itemIds, bpm, notes: '' });

test('licznik elementu liczy dni, nie sesje, i pamięta BPM', () => {
  const d = defaultData();
  d.sessions = [sess('2026-11-01', 'riffs', 20, ['a'], { a: 100 }), sess('2026-11-01', 'riffs', 10, ['a'], { a: 110 }), sess('2026-11-03', 'riffs', 20, ['a'], { a: 105 })];
  const s = statOf(itemIndex(d), 'a');
  assert.equal(s.count, 2);
  assert.equal(s.last, '2026-11-03');
  assert.equal(s.bpmLast, 105);
  assert.equal(s.bpmBest, 110);
});

test('rekomendacja: brak danych -> riffy, potem największy deficyt', () => {
  const d = defaultData();
  assert.equal(recommend(d, '2026-11-10').category, 'riffs');
  d.sessions = [sess('2026-11-09', 'riffs', 60)];
  const r = recommend(d, '2026-11-10');
  assert.equal(r.category, 'licks');
  assert.match(r.reason, /Licks: 0% vs cel 20%/);
  d.sessions = [sess('2026-11-09', 'licks', 20), sess('2026-11-09', 'chords', 20), sess('2026-11-09', 'scales', 10), sess('2026-11-09', 'riffs', 10)];
  assert.equal(recommend(d, '2026-11-10').category, 'riffs');
});

test('rekomendacja ignoruje sesje poza oknem', () => {
  const d = defaultData();
  d.sessions = [sess('2026-09-01', 'licks', 500)];
  assert.equal(recommend(d, '2026-11-10').empty, true);
});

test('seria dni, heatmapa, najdawniej niećwiczone', () => {
  const s = [sess('2026-11-08', 'riffs', 10), sess('2026-11-09', 'riffs', 10), sess('2026-11-10', 'riffs', 10)];
  assert.equal(streak(s, '2026-11-10'), 3);
  assert.equal(streak(s, '2026-11-11'), 3);
  assert.equal(streak(s, '2026-11-12'), 0);
  const h = heatmap(s, '2026-11-10', 12);
  assert.equal(h.length, 84);
  assert.equal(h.find((c) => c.date === '2026-11-10').minutes, 10);
  assert.equal(h[0].date, '2026-08-24');
  const d = defaultData();
  const first = d.items.find((i) => i.category === 'scales');
  d.sessions = [sess('2026-11-01', 'scales', 10, [first.id])];
  const stale = staleItems(d, itemIndex(d), 100);
  assert.equal(stale[stale.length - 1].item.id, first.id);
});
