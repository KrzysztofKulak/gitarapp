import { CAT_KEYS, CATEGORIES, addDays, todayStr } from './model.js';

// Suma minut na kategorię; days = null oznacza całość.
export function minutesByCategory(sessions, days, today = todayStr()) {
  const out = Object.fromEntries(CAT_KEYS.map((k) => [k, 0]));
  const from = days == null ? null : addDays(today, -(days - 1));
  for (const s of sessions) {
    if (from && (s.date < from || s.date > today)) continue;
    if (s.category in out) out[s.category] += Number(s.minutes) || 0;
  }
  return out;
}

export function recommend(data, today = todayStr()) {
  const { blockMinutes, targets, recommendationWindowDays } = data.settings;
  const minutes = minutesByCategory(data.sessions, recommendationWindowDays, today);
  const total = CAT_KEYS.reduce((a, k) => a + minutes[k], 0);
  const shares = Object.fromEntries(CAT_KEYS.map((k) => [k, total ? minutes[k] / total : 0]));
  const deficits = Object.fromEntries(CAT_KEYS.map((k) => [k, targets[k] * (total + blockMinutes) - minutes[k]]));
  if (!total) {
    return {
      category: 'riffs',
      reason: `Brak sesji w ostatnich ${recommendationWindowDays} dniach, zaczynamy od riffów.`,
      minutes, total, shares, deficits, empty: true,
    };
  }
  let category = CAT_KEYS[0];
  for (const k of CAT_KEYS) if (deficits[k] > deficits[category]) category = k;
  const pct = Math.round(shares[category] * 100);
  const goal = Math.round(targets[category] * 100);
  return {
    category,
    reason: `${CATEGORIES[category]}: ${pct}% vs cel ${goal}%`,
    minutes, total, shares, deficits, empty: false,
  };
}
