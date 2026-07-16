export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function calendarDayStarts(now: Date) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return {
    todayStart,
    yesterdayStart: todayStart - DAY_IN_MS,
  };
}

export function calendarDayDifference(date: Date, now: Date) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEntry = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startOfToday.getTime() - startOfEntry.getTime()) / DAY_IN_MS);
}
