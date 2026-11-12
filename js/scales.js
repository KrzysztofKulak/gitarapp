export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const OPEN_MIDI = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4 (strój standardowy)
const LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export function toPc(root) {
  if (typeof root === 'number') return ((root % 12) + 12) % 12;
  const m = /^([A-Ga-g])([#♯b♭]?)$/.exec(String(root).trim());
  if (!m) throw new Error(`Nieznany dźwięk: ${root}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  return (((base + acc) % 12) + 12) % 12;
}

// "1 ♭3 4 5 ♭7" -> [0, 3, 5, 7, 10]; null gdy zapis jest niepoprawny.
export function parseFormula(formula) {
  const tokens = String(formula || '').trim().split(/[\s,]+/).filter(Boolean);
  if (!tokens.length) return null;
  const out = [];
  for (const t of tokens) {
    const m = /^([♭♯b#]*)(\d{1,2})$/.exec(t);
    if (!m) return null;
    const deg = Number(m[2]);
    if (deg < 1) return null;
    const acc = [...m[1]].reduce((a, c) => a + (c === '♭' || c === 'b' ? -1 : 1), 0);
    const semis = MAJOR[(deg - 1) % 7] + 12 * Math.floor((deg - 1) / 7) + acc;
    out.push(((semis % 12) + 12) % 12);
  }
  const uniq = [...new Set(out)].sort((a, b) => a - b);
  return uniq[0] === 0 ? uniq : null;
}

export function notesPerString(count) {
  return count <= 6 ? 2 : count === 7 ? 3 : 4;
}

// Pozycje: 1 = start od tonu podstawowego na strunie E6, kolejne = start od kolejnego stopnia skali.
// 2 nuty na strunę (box) dla skal do 6 dźwięków, 3 dla 7-dźwiękowych, 4 dla 8-dźwiękowych.
// opts.high: start o oktawę wyżej (dla E: od 12. progu).
export function scaleFrets(root, intervals, position = 1, opts = {}) {
  const n = intervals.length;
  const nps = notesPerString(n);
  const startFret = (toPc(root) - 4 + 12) % 12;
  let rows;
  for (let attempt = opts.high ? 1 : 0; attempt < 2; attempt++) {
    const rootMidi = 40 + startFret + 12 * attempt;
    const pitch = (i) => rootMidi + 12 * Math.floor(i / n) + intervals[i % n];
    let idx = position - 1;
    rows = [];
    for (let s = 0; s < 6; s++) {
      const frets = [];
      for (let k = 0; k < nps; k++) frets.push(pitch(idx + k) - OPEN_MIDI[s]);
      idx += nps;
      rows.push(frets);
    }
    if (Math.min(...rows.flat()) >= 0) break;
  }
  return rows; // indeks 0 = struna E6
}

export function scaleTab(root, intervals, position = 1, opts = {}) {
  const rows = scaleFrets(root, intervals, position, opts);
  return [5, 4, 3, 2, 1, 0]
    .map((s) => `${LABELS[s]}|${rows[s].map((f) => String(f).padStart(2, '-') + '-').join('')}|`)
    .join('\n');
}

export function scaleTabs(root, intervals, positions = [1, 2], opts = {}) {
  const rootName = typeof root === 'number' ? NOTE_NAMES[root] : root;
  return positions
    .map((p) => `Pozycja ${p} (${rootName})\n${scaleTab(root, intervals, p, opts)}`)
    .join('\n\n');
}
