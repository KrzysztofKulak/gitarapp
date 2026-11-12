// Dane startowe. Pola root/type/bass służą tylko do weryfikacji (tools/verify-chords.mjs).
// Tab akordu: 6 znaków od niskiej E (6. struna) do wysokiej e (1. struna). x = struna wyciszona.

const p = 'power';
const d = 'dur-moll';
const s7 = 'septymowe';
const sa = 'sus-add';
const dk = 'mroczne';

export const SEED_CHORDS = [
  // Power chordy i warianty
  { name: 'E5', tab: '022xxx', root: 'E', type: '5', tags: [p] },
  { name: 'A5', tab: 'x022xx', root: 'A', type: '5', tags: [p] },
  { name: 'D5', tab: 'xx023x', root: 'D', type: '5', tags: [p] },
  { name: 'F5', tab: '133xxx', root: 'F', type: '5', tags: [p], note: 'przesuwny, root na E6' },
  { name: 'G5', tab: '355xxx', root: 'G', type: '5', tags: [p], note: 'przesuwny, root na E6' },
  { name: 'B♭5', tab: 'x133xx', root: 'Bb', type: '5', tags: [p], note: 'przesuwny, root na A5' },
  { name: 'C5', tab: 'x355xx', root: 'C', type: '5', tags: [p], note: 'przesuwny, root na A5' },
  { name: 'G5/D (odwrócony)', tab: 'x55xxx', root: 'G', type: '5', bass: 'D', tags: [p], note: 'kwinta w basie' },
  { name: 'A5/E (odwrócony)', tab: '002xxx', root: 'A', type: '5', bass: 'E', tags: [p], note: 'kwinta w basie' },
  { name: 'E5♭5 (tryton)', tab: '01xxxx', root: 'E', type: 'b5', tags: [p] },
  { name: 'D5 (Drop D)', tab: '000xxx', root: 'D', type: '5', tuning: 'dropD', tags: [p, 'drop-d'], note: 'strój DADGBE' },
  { name: 'F5 (Drop D)', tab: '333xxx', root: 'F', type: '5', tuning: 'dropD', tags: [p, 'drop-d'], note: 'strój DADGBE, jeden palec' },

  // Durowe i molowe: otwarte i barre
  { name: 'C', tab: 'x32010', root: 'C', type: 'maj', tags: [d] },
  { name: 'D', tab: 'xx0232', root: 'D', type: 'maj', tags: [d] },
  { name: 'E', tab: '022100', root: 'E', type: 'maj', tags: [d] },
  { name: 'G', tab: '320003', root: 'G', type: 'maj', tags: [d] },
  { name: 'A', tab: 'x02220', root: 'A', type: 'maj', tags: [d] },
  { name: 'F', tab: '133211', root: 'F', type: 'maj', tags: [d], note: 'barre' },
  { name: 'B♭', tab: 'x13331', root: 'Bb', type: 'maj', tags: [d], note: 'barre' },
  { name: 'B', tab: 'x24442', root: 'B', type: 'maj', tags: [d], note: 'barre' },
  { name: 'Am', tab: 'x02210', root: 'A', type: 'm', tags: [d] },
  { name: 'Dm', tab: 'xx0231', root: 'D', type: 'm', tags: [d] },
  { name: 'Em', tab: '022000', root: 'E', type: 'm', tags: [d] },
  { name: 'Bm', tab: 'x24432', root: 'B', type: 'm', tags: [d], note: 'barre' },
  { name: 'F#m', tab: '244222', root: 'F#', type: 'm', tags: [d], note: 'barre' },
  { name: 'Gm', tab: '355333', root: 'G', type: 'm', tags: [d], note: 'barre' },
  { name: 'Cm', tab: 'x35543', root: 'C', type: 'm', tags: [d], note: 'barre' },
  { name: 'Fm', tab: '133111', root: 'F', type: 'm', tags: [d], note: 'barre' },

  // Septymowe
  { name: 'A7', tab: 'x02020', root: 'A', type: '7', tags: [s7] },
  { name: 'E7', tab: '020100', root: 'E', type: '7', tags: [s7] },
  { name: 'D7', tab: 'xx0212', root: 'D', type: '7', tags: [s7] },
  { name: 'B7', tab: 'x21202', root: 'B', type: '7', tags: [s7] },
  { name: 'Am7', tab: 'x02010', root: 'A', type: 'm7', tags: [s7] },
  { name: 'Em7', tab: '022030', root: 'E', type: 'm7', tags: [s7] },
  { name: 'Dm7', tab: 'xx0211', root: 'D', type: 'm7', tags: [s7] },
  { name: 'Cmaj7', tab: 'x32000', root: 'C', type: 'maj7', tags: [s7] },

  // Sus / add
  { name: 'Asus2', tab: 'x02200', root: 'A', type: 'sus2', tags: [sa] },
  { name: 'Asus4', tab: 'x02230', root: 'A', type: 'sus4', tags: [sa] },
  { name: 'Dsus2', tab: 'xx0230', root: 'D', type: 'sus2', tags: [sa] },
  { name: 'Dsus4', tab: 'xx0233', root: 'D', type: 'sus4', tags: [sa] },
  { name: 'Esus4', tab: '022200', root: 'E', type: 'sus4', tags: [sa] },
  { name: 'A7sus4', tab: 'x02030', root: 'A', type: '7sus4', tags: [sa] },
  { name: 'Csus2 (barre)', tab: 'x35533', root: 'C', type: 'sus2', tags: [sa], note: 'barre' },
  { name: 'Em(add9)', tab: '024000', root: 'E', type: 'madd9', tags: [sa] },

  // Mroczne / napięciowe
  { name: 'Bdim', tab: 'x2343x', root: 'B', type: 'dim', tags: [dk] },
  { name: 'Cdim7', tab: 'x3424x', root: 'C', type: 'dim7', tags: [dk] },
  { name: 'Caug', tab: 'x32110', root: 'C', type: 'aug', tags: [dk] },
  { name: 'Em(maj7)', tab: '021000', root: 'E', type: 'mmaj7', tags: [dk] },
  { name: 'E7#9', tab: 'x7678x', root: 'E', type: '7#9', tags: [dk] },
  { name: 'F/E (frygijski)', tab: '033211', root: 'F', type: 'maj', bass: 'E', tags: [dk] },
];

export const SEED_SCALES = [
  { name: 'Pentatonika molowa', formula: '1 ♭3 4 5 ♭7', description: 'Podstawa leadów, heavy/hard rock.' },
  { name: 'Skala bluesowa', formula: '1 ♭3 4 ♭5 5 ♭7', description: 'Klasyczny heavy, groove.' },
  { name: 'Moll naturalny (eolska)', formula: '1 2 ♭3 4 5 ♭6 ♭7', description: 'Najczęstsza skala w metalu, pasuje do power chordów.' },
  { name: 'Dorycka', formula: '1 2 ♭3 4 5 6 ♭7', description: 'Jaśniejszy moll, prog/groove.' },
  { name: 'Frygijska', formula: '1 ♭2 ♭3 4 5 ♭6 ♭7', description: 'Thrash, death, black, mroczne riffy.' },
  { name: 'Lokrycka', formula: '1 ♭2 ♭3 4 ♭5 ♭6 ♭7', description: 'Dysonansowe riffy, death/djent.' },
  { name: 'Moll harmoniczny', formula: '1 2 ♭3 4 5 ♭6 7', description: 'Neoklasyka, „klasyczne” brzmienie.' },
  { name: 'Frygijska dominantowa', formula: '1 ♭2 3 4 5 ♭6 ♭7', description: '5. tryb molla harmonicznego, „orientalne” brzmienie.' },
  { name: 'Moll węgierski', formula: '1 2 ♭3 ♯4 5 ♭6 7', description: 'Bardzo mroczna, egzotyczna.' },
  { name: 'Zmniejszona (półton–cały ton)', formula: '1 ♭2 ♭3 3 ♯4 5 6 ♭7', description: 'Napięcie, przejścia, techniczny metal.' },
];
