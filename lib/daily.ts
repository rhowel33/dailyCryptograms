import { quotes, type Quote } from "./quotes";
import { buildCipher, rngFromString, encrypt, type Cipher } from "./cipher";

export type Puzzle = {
  dateKey: string; // storage/identity key — date string for daily, "archive-N" for archive
  number: number; // 1-based archive number (index in quotes + 1)
  quote: Quote;
  cipher: Cipher; // encrypted -> plain
  encrypted: string;
};

// First day the site went live. Archive entries for puzzles that haven't
// been served as a daily yet are gated until the date they're scheduled.
export const LAUNCH_DATE_KEY = "2026-05-03";

export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Days since launch, 1-based. Launch day → 1. Returns 0 if `now` is before launch.
 * The quotes array is pre-shuffled (see scripts/shuffle-quotes.mjs), so this
 * doubles as the puzzle number: puzzle #N === quotes[N - 1].
 */
export function puzzleNumberForDate(now: Date = new Date()): number {
  const launch = parseLocalDateKey(LAUNCH_DATE_KEY);
  const today = parseLocalDateKey(localDateKey(now));
  const days = Math.round((today.getTime() - launch.getTime()) / MS_PER_DAY);
  return days < 0 ? 0 : days + 1;
}

export function isPuzzleReleased(
  n: number,
  now: Date = new Date(),
  daysAhead: number = 0
): boolean {
  if (!Number.isInteger(n) || n < 1 || n > quotes.length) return false;
  return n <= puzzleNumberForDate(now) + daysAhead;
}

export function totalPuzzleCount(): number {
  return quotes.length;
}

function buildPuzzleFromQuote(
  storageKey: string,
  cipherSeed: string,
  number: number,
  quote: Quote
): Puzzle {
  const rng = rngFromString(cipherSeed);
  const cipher = buildCipher(rng);
  // Encrypt the attribution as part of the puzzle so the player has to decode
  // the author's name too. The "--" separator is preserved verbatim by the
  // cipher (non-letters pass through), giving a clear visual divider.
  const plaintext = `${quote.text} -- ${quote.author}`;
  const encrypted = encrypt(plaintext, cipher);
  return { dateKey: storageKey, number, quote, cipher, encrypted };
}

export function todaysPuzzle(now: Date = new Date()): Puzzle {
  const dateKey = localDateKey(now);
  // Days-since-launch is the puzzle number; quotes are pre-shuffled so they
  // can be pulled in order. Wrap with modulo so the site keeps working past
  // the end of the pool.
  const n = puzzleNumberForDate(now);
  const idx = ((n - 1) % quotes.length + quotes.length) % quotes.length;
  // Cipher seed differs from the archive seed so today's daily and the
  // archive copy of the same quote use different ciphers.
  return buildPuzzleFromQuote(dateKey, dateKey, n, quotes[idx]);
}

export function puzzleByNumber(n: number): Puzzle | null {
  if (!Number.isInteger(n) || n < 1 || n > quotes.length) return null;
  const quote = quotes[n - 1];
  const key = `archive-${n}`;
  return buildPuzzleFromQuote(key, key, n, quote);
}

/**
 * Milliseconds remaining until next local midnight.
 */
export function msUntilLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}
