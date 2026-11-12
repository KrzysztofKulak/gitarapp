import { addDays, parseDate, statOf } from './model.js';

// Seria kolejnych dni z ćwiczeniem; jeśli dziś jeszcze nic, liczona od wczoraj.
export function streak(sessions, today) {
  const days = new Set(sessions.map((s) => s.date));
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// Komórki od poniedziałku sprzed (weeks-1) tygodni do dziś, kolejność: dzień po dniu.
export function heatmap(sessions, today, weeks = 12) {
  const byDay = {};
  for (const s of sessions) byDay[s.date] = (byDay[s.date] || 0) + (Number(s.minutes) || 0);
  const dow = (parseDate(today).getDay() + 6) % 7;
  const start = addDays(today, -dow - 7 * (weeks - 1));
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(start, i);
    cells.push({ date, minutes: byDay[date] || 0, future: date > today });
  }
  return cells;
}

export function heatLevel(minutes) {
  return minutes <= 0 ? 0 : minutes < 20 ? 1 : minutes < 40 ? 2 : minutes < 60 ? 3 : 4;
}

// Niearchiwizowane elementy, najdawniej niećwiczone (lub nigdy) na początku.
export function staleItems(data, idx, limit = 10) {
  return data.items
    .filter((it) => !it.archived)
    .map((item) => ({ item, last: statOf(idx, item.id).last }))
    .sort((a, b) => {
      if (!a.last && !b.last) return a.item.name.localeCompare(b.item.name, 'pl');
      if (!a.last) return -1;
      if (!b.last) return 1;
      return a.last.localeCompare(b.last);
    })
    .slice(0, limit);
}
