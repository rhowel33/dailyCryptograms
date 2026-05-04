export type SavedProgress = {
  dateKey: string;
  guess: Record<string, string>; // encrypted letter -> guessed plain letter (uppercase)
  hints: number;
  solved: boolean;
  // Fingerprint of the puzzle this progress belongs to. The guess map is
  // keyed by encrypted letters, so a change to either the quote or the
  // cipher makes saved guesses meaningless — the encrypted string captures
  // both and lets us detect the mismatch on load.
  encrypted: string;
  // Unix-ms timestamp of the first user input on this puzzle, or null if the
  // user hasn't typed anything yet. Persisted so the timer survives reloads.
  startedAt: number | null;
  // Final solve duration in ms, frozen the moment the puzzle is solved.
  durationMs: number | null;
};

const KEY_PREFIX = "dc-progress:";

/**
 * Load saved progress for `dateKey` only if it was recorded against the same
 * puzzle that's currently being rendered (`encrypted` must match). Mismatched
 * or legacy entries return null so the user starts fresh against the live puzzle.
 */
export function loadProgress(
  dateKey: string,
  encrypted: string
): SavedProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + dateKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgress;
    if (parsed.dateKey !== dateKey) return null;
    if (parsed.encrypted !== encrypted) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProgress(p: SavedProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + p.dateKey, JSON.stringify(p));
  } catch {
    // ignore quota / disabled storage
  }
}

export function clearProgress(dateKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + dateKey);
  } catch {
    // ignore
  }
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Removes daily-progress entries whose date is strictly before `todayKey`.
 * Past dailies are unreachable — the loader only matches against the current
 * `localDateKey()`, so older entries are dead weight. Archive entries
 * (`dc-progress:archive-N`) are intentionally preserved so users can resume
 * a half-finished archive puzzle on a later visit.
 */
export function pruneStaleProgress(todayKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const ls = window.localStorage;
    const toRemove: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      const suffix = key.slice(KEY_PREFIX.length);
      if (!DATE_KEY_RE.test(suffix)) continue; // skip archive-* and other shapes
      if (suffix < todayKey) toRemove.push(key); // YYYY-MM-DD compares lexicographically
    }
    for (const key of toRemove) ls.removeItem(key);
  } catch {
    // ignore quota / disabled storage
  }
}
