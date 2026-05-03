export type SavedProgress = {
  dateKey: string;
  guess: Record<string, string>; // encrypted letter -> guessed plain letter (uppercase)
  hints: number;
  solved: boolean;
};

const KEY_PREFIX = "dc-progress:";

export function loadProgress(dateKey: string): SavedProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + dateKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgress;
    if (parsed.dateKey !== dateKey) return null;
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
