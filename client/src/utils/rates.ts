import type { RateHistory } from '../types';

/**
 * Given a sorted list of rate history entries (newest first) and a date string,
 * returns the rate that was active on that date.
 *
 * RateHistory stores when a rate *started*: { value: 130, date: "2026-06-01" }
 * means the rate was 130 from June 1 onwards (until the next entry).
 *
 * @param dateStr  - "YYYY-MM-DD" date to look up
 * @param history  - RateHistory[] sorted newest-first
 * @param currentRate - the latest rate value (Rate.value)
 * @param currentDate - the date the current rate was set (Rate.date)
 */
export function getRateForDate(
  dateStr: string,
  history: RateHistory[],
  currentRate: number,
  currentDate: string,
): number {
  // Build a timeline: each entry is { date, value }
  // Current rate is the most recent
  const timeline: { date: string; value: number }[] = [
    { date: currentDate, value: currentRate },
    ...history.map(h => ({ date: h.date, value: h.value })),
  ];

  // Sort by date descending (newest first)
  timeline.sort((a, b) => b.date.localeCompare(a.date));

  // Find the first entry whose date <= dateStr
  for (const entry of timeline) {
    if (entry.date <= dateStr) return entry.value;
  }

  // If all history is after dateStr, use the oldest known rate
  return timeline[timeline.length - 1].value;
}

/**
 * Calculate revenue for an array of milk entries using historical rates.
 * @param milkEntries - array of { date, morning, evening, ... }
 * @param history - RateHistory[] (newest first)
 * @param currentRate - latest rate
 * @param currentDate - date current rate was set
 * @returns total revenue
 */
export function saleableMilkLiters(m: { morning?: number; evening?: number; calfMilk?: number }): number {
  return Math.max(0, (m.morning || 0) + (m.evening || 0) - (m.calfMilk || 0));
}

export function calcRevenueWithHistory(
  milkEntries: { date: string; morning: number; evening: number; calfMilk?: number }[],
  history: RateHistory[],
  currentRate: number,
  currentDate: string,
): number {
  let total = 0;
  for (const m of milkEntries) {
    const rate = getRateForDate(m.date, history, currentRate, currentDate);
    total += saleableMilkLiters(m) * rate;
  }
  return Math.round(total * 100) / 100;
}
