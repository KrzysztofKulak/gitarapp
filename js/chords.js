import { NOTE_NAMES, toPc } from './scales.js';

export const TUNINGS = {
  standard: { label: 'Strój standardowy (EADGBE)', open: [4, 9, 2, 7, 11, 4], labels: ['E', 'A', 'D', 'G', 'B', 'e'] },
  dropD: { label: 'Drop D (DADGBE)', open: [2, 9, 2, 7, 11, 4], labels: ['D', 'A', 'D', 'G', 'B', 'e'] },
};

// "x32010" lub "x,10,12,12,12,10" -> [null,3,2,0,1,0]; null gdy zapis jest niepoprawny.
export function parseTab(tab) {
  if (typeof tab !== 'string') return null;
  const s = tab.trim();
  const parts = /[,\s]/.test(s) ? s.split(/[,\s]+/) : s.split('');
  if (parts.length !== 6) return null;
  const out = [];
  for (const p of parts) {
    if (/^[xX]$/.test(p)) out.push(null);
    else if (/^\d{1,2}$/.test(p)) out.push(Number(p));
    else return null;
  }
  return out;
}

export const isValidTab = (tab) => parseTab(tab) !== null;

// Klasy dźwięków (0-11) od struny E6 do e1, null dla wyciszonych.
export function playedPitchClasses(tab, tuning = 'standard') {
  const frets = parseTab(tab);
  if (!frets) return [];
  const open = (TUNINGS[tuning] || TUNINGS.standard).open;
  return frets.map((f, i) => (f === null ? null : (open[i] + f) % 12));
}

export function chordNotes(tab, tuning = 'standard') {
  return playedPitchClasses(tab, tuning).filter((n) => n !== null).map((n) => NOTE_NAMES[n]);
}

export function verticalTab(tab, tuning = 'standard') {
  const frets = parseTab(tab);
  if (!frets) return '';
  const labels = (TUNINGS[tuning] || TUNINGS.standard).labels;
  const w = Math.max(...frets.map((f) => (f === null ? 1 : String(f).length)));
  return [5, 4, 3, 2, 1, 0]
    .map((i) => `${labels[i]}|-${(frets[i] === null ? 'x' : String(frets[i])).padEnd(w, '-')}-|`)
    .join('\n');
}

export function diagramSvg(tab) {
  const f = parseTab(tab);
  if (!f) return '';
  const fretted = f.filter((x) => x > 0);
  const max = Math.max(0, ...fretted);
  const min = fretted.length ? Math.min(...fretted) : 1;
  const base = max <= 5 ? 1 : min;
  const rows = 5;
  const X0 = 22, DX = 16, Y0 = 30, DY = 20;
  const W = 138, H = Y0 + rows * DY + 8;
  const right = X0 + 5 * DX;
  let s = `<svg class="chord-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagram chwytu ${tab}">`;
  for (let r = 0; r <= rows; r++) {
    const y = Y0 + r * DY;
    s += `<line x1="${X0}" y1="${y}" x2="${right}" y2="${y}" stroke="currentColor" stroke-width="${r === 0 && base === 1 ? 4 : 1}"/>`;
  }
  for (let i = 0; i < 6; i++) {
    const x = X0 + i * DX;
    s += `<line x1="${x}" y1="${Y0}" x2="${x}" y2="${Y0 + rows * DY}" stroke="currentColor" stroke-width="1"/>`;
  }
  f.forEach((fr, i) => {
    const x = X0 + i * DX;
    if (fr === null) s += `<text x="${x}" y="22" text-anchor="middle" font-size="14" fill="currentColor">×</text>`;
    else if (fr === 0) s += `<circle cx="${x}" cy="16" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
    else {
      const r = fr - base;
      if (r >= 0 && r < rows) s += `<circle cx="${x}" cy="${Y0 + r * DY + DY / 2}" r="7" class="dot"/>`;
    }
  });
  if (base > 1) s += `<text x="${right + 8}" y="${Y0 + DY / 2 + 4}" font-size="12" fill="currentColor">${base}fr</text>`;
  return s + '</svg>';
}

// Składniki akordu w półtonach od prymy. req = wymagane, opt = dozwolone, ale opcjonalne.
export const CHORD_TYPES = {
  '5': { req: [0, 7], opt: [] },
  b5: { req: [0, 6], opt: [] },
  maj: { req: [0, 4, 7], opt: [] },
  m: { req: [0, 3, 7], opt: [] },
  '7': { req: [0, 4, 10], opt: [7] },
  m7: { req: [0, 3, 10], opt: [7] },
  maj7: { req: [0, 4, 11], opt: [7] },
  sus2: { req: [0, 2, 7], opt: [] },
  sus4: { req: [0, 5, 7], opt: [] },
  '7sus4': { req: [0, 5, 10], opt: [7] },
  dim: { req: [0, 3, 6], opt: [] },
  dim7: { req: [0, 3, 6, 9], opt: [] },
  aug: { req: [0, 4, 8], opt: [] },
  madd9: { req: [0, 2, 3], opt: [7] },
  mmaj7: { req: [0, 3, 11], opt: [7] },
  '7#9': { req: [0, 4, 10, 3], opt: [7] },
};

// spec: { name, tab, root, type, bass?, tuning? }
export function verifyChord(spec) {
  const problems = [];
  const type = CHORD_TYPES[spec.type];
  if (!type) return { ok: false, problems: [`nieznany typ akordu: ${spec.type}`], notes: [] };
  if (!isValidTab(spec.tab)) return { ok: false, problems: ['nieprawidłowy zapis taba'], notes: [] };
  const root = toPc(spec.root);
  const rel = (n) => (n - root + 12) % 12;
  const played = playedPitchClasses(spec.tab, spec.tuning).filter((n) => n !== null);
  const bassRel = spec.bass ? rel(toPc(spec.bass)) : 0;
  const allowed = new Set([...type.req, ...type.opt, bassRel]);
  for (const n of played) if (!allowed.has(rel(n))) problems.push(`dźwięk ${NOTE_NAMES[n]} nie należy do akordu`);
  for (const r of type.req) {
    if (!played.some((n) => rel(n) === r)) problems.push(`brak dźwięku ${NOTE_NAMES[(root + r) % 12]}`);
  }
  if (played.length && rel(played[0]) !== bassRel) {
    problems.push(`bas to ${NOTE_NAMES[played[0]]}, a powinien być ${NOTE_NAMES[(root + bassRel) % 12]}`);
  }
  return { ok: problems.length === 0, problems, notes: played.map((n) => NOTE_NAMES[n]) };
}
