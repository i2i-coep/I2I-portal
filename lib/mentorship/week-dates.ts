// Weekly date ranges for the 8 mentorship meets, anchored to the
// mentorship period's start date (phase_settings.opens_at for phase_number
// 3, "Phase 3.1 – Mentorship" — set by the Secretary from the Phase
// Engine). Week 1 = start date through start date + 6 days, Week 2 the
// next 7 days, and so on.

export function getWeekRange(startIso: string, weekNumber: number): { start: Date; end: Date } {
  const start = new Date(startIso);
  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() + (weekNumber - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return { start: weekStart, end: weekEnd };
}

export function formatWeekRange(startIso: string, weekNumber: number): string {
  const { start, end } = getWeekRange(startIso, weekNumber);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// null = mentorship hasn't started yet, or we're past week 8.
export function getCurrentWeekNumber(startIso: string | null): number | null {
  if (!startIso) return null;
  const start = new Date(startIso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return null;
  const week = Math.floor(diffDays / 7) + 1;
  return week >= 1 && week <= 8 ? week : null;
}
