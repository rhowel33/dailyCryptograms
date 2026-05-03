export type StreakData = {
  current: number;
  longest: number;
  lastSolvedDate: string | null;
};

const STREAK_KEY = "dc-streak";

const empty: StreakData = { current: 0, longest: 0, lastSolvedDate: null };

export function loadStreak(): StreakData {
  if (typeof window === "undefined") return { ...empty };
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (!raw) return { ...empty };
    const parsed = JSON.parse(raw) as Partial<StreakData>;
    return {
      current: parsed.current ?? 0,
      longest: parsed.longest ?? 0,
      lastSolvedDate: parsed.lastSolvedDate ?? null,
    };
  } catch {
    return { ...empty };
  }
}

function saveStreak(s: StreakData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(s));
  } catch {
    // ignore quota / disabled storage
  }
}

function previousDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Records a solve for the given date. Idempotent per date — calling twice
 * for the same dateKey will not double-count.
 */
export function recordSolve(dateKey: string): StreakData {
  const s = loadStreak();
  if (s.lastSolvedDate === dateKey) return s;
  const yesterday = previousDateKey(dateKey);
  const current = s.lastSolvedDate === yesterday ? s.current + 1 : 1;
  const next: StreakData = {
    current,
    longest: Math.max(s.longest, current),
    lastSolvedDate: dateKey,
  };
  saveStreak(next);
  return next;
}

/**
 * The streak value to display: stored current if the last solve was today or
 * yesterday, otherwise 0 (the streak has lapsed but storage isn't rewritten
 * until the next solve).
 */
export function effectiveCurrent(s: StreakData, todayKey: string): number {
  if (!s.lastSolvedDate) return 0;
  if (s.lastSolvedDate === todayKey) return s.current;
  if (s.lastSolvedDate === previousDateKey(todayKey)) return s.current;
  return 0;
}
