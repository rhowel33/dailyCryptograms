import { quotes, type Quote } from "./quotes";
import { buildCipher, rngFromString, encrypt, type Cipher } from "./cipher";

export type Puzzle = {
  dateKey: string;
  quote: Quote;
  cipher: Cipher; // encrypted -> plain
  encrypted: string;
};

export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildPuzzle(seed: string, quote: Quote): Puzzle {
  const rng = rngFromString(seed);
  const cipher = buildCipher(rng);
  const encrypted = encrypt(quote.text, cipher);
  return { dateKey: seed, quote, cipher, encrypted };
}

export function todaysPuzzle(now: Date = new Date()): Puzzle {
  const dateKey = localDateKey(now);
  const indexRng = rngFromString("quote:" + dateKey);
  const idx = Math.floor(indexRng() * quotes.length);
  return buildPuzzle(dateKey, quotes[idx]);
}

/**
 * Milliseconds remaining until next local midnight.
 */
export function msUntilLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}
