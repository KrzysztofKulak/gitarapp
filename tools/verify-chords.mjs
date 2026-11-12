// Weryfikuje listę startową akordów: dźwięki z progów vs skład akordu z nazwy.
// Użycie: node tools/verify-chords.mjs
import { SEED_CHORDS } from '../data/seed.js';
import { verifyChord } from '../js/chords.js';

let bad = 0;
for (const c of SEED_CHORDS) {
  const r = verifyChord(c);
  const line = `${r.ok ? 'OK ' : 'BŁĄD'}  ${c.name.padEnd(22)} ${c.tab}  ${r.notes.join(' ')}`;
  console.log(line + (r.ok ? '' : `  <- ${r.problems.join('; ')}`));
  if (!r.ok) bad++;
}
console.log(`\n${SEED_CHORDS.length} akordów, błędnych: ${bad}`);
process.exit(bad ? 1 : 0);
